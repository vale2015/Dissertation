import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const jsonFile = 'usage-history.json';
const historyFile = 'USAGE_HISTORY.md';
const flagsFile = 'OPTIMIZATION_FLAGS.md';
const lockFile = '.usage-history.lock';
const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/;
const slugPattern = /^[a-z\d][a-z\d_-]{0,63}$/;
const labelPattern = /^[a-z\d](?:[a-z\d ()-]{0,78}[a-z\d)])?$/i;
const modelPattern = /^[a-z\d][a-z\d._-]{0,63}$/i;
const efforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const scopes = new Set(['partial', 'full']);
const states = new Set(['snapshot', 'closed']);
const coverageStatuses = new Set(['observed', 'partial', 'unavailable']);
const fields = [
  'input_tokens', 'cached_input_tokens', 'uncached_input_tokens', 'cache_write_input_tokens',
  'output_tokens', 'reasoning_output_tokens', 'total_tokens',
];
const thresholds = Object.freeze({
  averageResponses: 10,
  averageInput: 50_000,
  coordinatorInput: 250_000,
  coordinatorShare: 0.60,
  baselineRuns: 3,
  baselineRatio: 1.5,
});

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const matches = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const hasKeys = (value, keys) => isObject(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const knownSum = values => values.some(value => value === null)
  ? null : sumOrNull(values.reduce((sum, value) => sum + value, 0));
const sumOrNull = value => isCount(value) ? value : null;
const countFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const count = value => value === null ? 'Unavailable' : countFormat.format(value);

function requireValid(condition, field) {
  if (!condition) throw new Error('Invalid usage history data for ' + field + '.');
}

function isTimestamp(value) {
  return matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function identity({ runId, category, label, scope }) {
  requireValid(matches(slugPattern, runId), 'run ID (lowercase letters, digits, hyphens or underscores)');
  requireValid(matches(slugPattern, category), 'category (lowercase letters, digits, hyphens or underscores)');
  requireValid(matches(labelPattern, label), 'label (letters, digits, spaces, hyphens or parentheses)');
  requireValid(scopes.has(scope), 'scope (partial or full)');
  return { runId, category, label, scope };
}

function selection(value) {
  const { root_thread_id: rootThreadId, root_turn_id: rootTurnId, window } = value;
  requireValid(matches(uuidPattern, rootThreadId), 'root thread');
  requireValid(rootTurnId === null || matches(uuidPattern, rootTurnId), 'root turn');
  requireValid(isObject(window) && isTimestamp(window.start) && isTimestamp(window.end)
    && window.start < window.end, 'UTC window');
  return { root_thread_id: rootThreadId, root_turn_id: rootTurnId, window: { start: window.start, end: window.end } };
}

function aggregate(value) {
  requireValid(isObject(value) && isCount(value.response_count) && isObject(value.totals), 'response counts');
  const totals = Object.fromEntries(fields.map(field => {
    const amount = value.totals[field];
    requireValid(amount === null || (value.response_count > 0 && isCount(amount)), field);
    return [field, amount];
  }));
  const { input_tokens: input, cached_input_tokens: cached, uncached_input_tokens: uncached,
    output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: total } = totals;
  const validUncached = input === null || cached === null ? uncached === null
    : cached <= input && uncached === input - cached;
  requireValid(validUncached, 'input subsets');
  requireValid(output === null || reasoning === null || reasoning <= output, 'output subsets');
  requireValid(total === null || input === null || output === null || total === sumOrNull(input + output), 'total tokens');
  return { response_count: value.response_count, totals };
}

function models(value) {
  requireValid(Array.isArray(value), 'model groups');
  const seen = new Set();
  return value.map(group => {
    requireValid(isObject(group) && (group.model === null || matches(modelPattern, group.model))
      && (group.effort === null || efforts.has(group.effort)) && group.response_count > 0, 'model group');
    const key = JSON.stringify([group.model, group.effort]);
    requireValid(!seen.has(key), 'unique model groups');
    seen.add(key);
    return { model: group.model, effort: group.effort, ...aggregate(group) };
  });
}

function validateGroups(overall, groups) {
  requireValid(knownSum(groups.map(group => group.response_count)) === overall.response_count, 'group response counts');
  const observed = groups.filter(group => group.response_count > 0);
  for (const field of fields) {
    const sum = observed.length ? knownSum(observed.map(group => group.totals[field])) : null;
    requireValid(sum === overall.totals[field], 'group token totals');
  }
}

function snapshot(value, status = value.coverage, rootInput = value.root_input_tokens, threadIds = value.thread_ids) {
  const overall = aggregate(value);
  const byModel = models(value.by_model);
  validateGroups(overall, byModel);
  requireValid(coverageStatuses.has(status), 'coverage status');
  if (status === 'observed') {
    requireValid(Object.values(overall.totals).every(isCount)
      && byModel.every(group => group.model !== null && group.effort !== null), 'observed coverage');
  }
  if (status === 'unavailable') {
    requireValid(Object.values(overall.totals).every(amount => amount === null), 'unavailable coverage');
  }
  requireValid(rootInput === null || (isCount(rootInput) && overall.response_count > 0
    && (overall.totals.input_tokens === null || rootInput <= overall.totals.input_tokens)), 'root input');
  requireValid(Array.isArray(threadIds) && threadIds.includes(value.root_thread_id)
    && threadIds.every(id => matches(uuidPattern, id)) && new Set(threadIds).size === threadIds.length, 'selected thread IDs');
  return {
    ...selection(value), ...overall, by_model: byModel, coverage: status,
    root_input_tokens: rootInput, thread_ids: [...threadIds].sort(),
  };
}

function workflowState(state) {
  requireValid(states.has(state), 'state (snapshot or closed)');
  return state;
}

function runFromReport(report, metadata) {
  requireValid(isObject(report) && report.schema_version === 1, 'report schema version');
  requireValid(isObject(report.coverage) && report.coverage.source === 'codex_rollout_token_usage_record', 'report coverage source');
  requireValid(Array.isArray(report.by_thread), 'thread groups');
  const seen = new Set();
  const threads = report.by_thread.map(thread => {
    requireValid(isObject(thread) && matches(uuidPattern, thread.thread_id) && !seen.has(thread.thread_id), 'thread group');
    requireValid(thread.thread_id === report.root_thread_id
      ? thread.parent_thread_id === null : matches(uuidPattern, thread.parent_thread_id), 'thread parent');
    seen.add(thread.thread_id);
    return { thread_id: thread.thread_id, ...aggregate(thread) };
  });
  const root = threads.find(thread => thread.thread_id === report.root_thread_id);
  requireValid(threads.length === 0 || root, 'root thread group');
  validateGroups(aggregate(report), threads);
  return {
    ...identity(metadata),
    state: workflowState(metadata.state ?? 'snapshot'),
    ...snapshot(report, report.coverage.status, root?.totals.input_tokens ?? null,
      [...new Set([report.root_thread_id, ...seen])]),
  };
}

function overlaps(first, second) {
  return first.thread_ids.some(id => second.thread_ids.includes(id))
    && (!first.root_turn_id || !second.root_turn_id || first.root_turn_id === second.root_turn_id)
    && first.window.start < second.window.end && second.window.start < first.window.end;
}

function validateLedger(ledger) {
  requireValid(hasKeys(ledger, ['schema_version', 'runs']) && ledger.schema_version === 1
    && Array.isArray(ledger.runs), 'ledger schema version');
  const seen = new Set();
  const runs = [];
  for (const item of ledger.runs) {
    requireValid(isObject(item), 'stored run');
    const run = { ...identity(item), state: workflowState(item.state), ...snapshot(item) };
    requireValid(hasKeys(item, Object.keys(run)) && hasKeys(item.window, ['start', 'end'])
      && hasKeys(item.totals, fields) && item.by_model.every(group => hasKeys(group, ['model', 'effort', 'response_count', 'totals'])
        && hasKeys(group.totals, fields)), 'stored run fields');
    requireValid(!seen.has(run.runId), 'unique run IDs');
    requireValid(!runs.some(other => overlaps(run, other)), 'nonoverlapping run windows');
    seen.add(run.runId);
    runs.push(run);
  }
  return { schema_version: 1, runs };
}

function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
}

function evaluate(run, otherRuns) {
  const { input_tokens: input, total_tokens: total } = run.totals;
  const flags = [];
  const add = (id, priority, title, evidence, action, verification) =>
    flags.push({ id, priority, title, evidence, action, verification });

  if (run.coverage !== 'observed' || run.scope === 'partial') {
    add('telemetry-coverage', 'note', 'Review the coverage and workflow window',
      'Selected scope is ' + run.scope + ' and telemetry is ' + run.coverage + ' for '
        + count(run.response_count) + ' recorded responses. Unknown usage remains unavailable.',
      'Capture from the actual workflow start and review missing rollout records and token fields.',
      'Confirm the intended window and inspect coverage after the next capture.');
  }
  if (input !== null && run.response_count >= thresholds.averageResponses
    && input / run.response_count >= thresholds.averageInput) {
    add('large-average-input', 'warning', 'Try a shorter task packet',
      count(input) + ' input tokens across ' + count(run.response_count) + ' recorded responses averaged '
        + count(input / run.response_count) + ' input tokens per response.',
      'Use a shorter task packet and carry forward only the evidence needed for the next decision.',
      'Compare average input, cached and uncached input, and task outcomes on comparable observed runs.');
  }
  if (input !== null && run.root_input_tokens !== null && run.root_input_tokens >= thresholds.coordinatorInput
    && run.root_input_tokens / input >= thresholds.coordinatorShare) {
    add('coordinator-majority-input', 'warning', 'Review coordinator context',
      'The root thread recorded ' + count(run.root_input_tokens) + ' of ' + count(input) + ' workflow input tokens ('
        + countFormat.format(run.root_input_tokens / input * 100) + '% of recorded input).',
      'Try shorter coordinator replies and carry forward concise specialist handoffs.',
      'Compare the root share, workflow input and completion evidence across comparable observed runs.');
  }

  const currentComparable = run.scope === 'full' && run.state === 'closed' && run.coverage === 'observed' && total !== null;
  const candidates = otherRuns.filter(other => other.runId !== run.runId && other.category === run.category
    && other.scope === 'full' && other.state === 'closed' && other.coverage === 'observed' && other.totals.total_tokens !== null
    && Boolean(other.root_turn_id) === Boolean(run.root_turn_id) && other.window.end < run.window.end);
  if (!currentComparable || candidates.length < thresholds.baselineRuns) {
    add('baseline-insufficient', 'note', 'Insufficient comparable baseline',
      count(candidates.length) + ' prior comparable runs are available. The current capture '
        + (currentComparable ? 'qualifies' : 'is ineligible') + ' for a comparison requiring at least '
        + thresholds.baselineRuns + ' prior full, closed, observed runs in the same category and selection type.',
      'Collect full windows with observed telemetry for similar work and close them on completion.',
      'Match the category and selection type and review the task scope before comparing totals.');
  } else {
    const baseline = median(candidates.map(other => other.totals.total_tokens));
    if (total > thresholds.baselineRatio * baseline) {
      add('above-category-baseline', 'warning', 'Review the above-baseline total',
        count(total) + ' total tokens exceeded ' + thresholds.baselineRatio + '× the median of '
          + count(baseline) + ' tokens across ' + count(candidates.length) + ' prior comparable runs.',
        'Review task complexity and per-model usage before changing routing or context.',
        'Compare matched workflows after the change and verify their outcomes and required checks.');
    }
  }
  return flags.sort((first, second) => Number(second.priority === 'warning') - Number(first.priority === 'warning'));
}

export function analyzeUsage(report, previousRuns = [], metadata = {}) {
  return evaluate(runFromReport(report, metadata), previousRuns);
}

const recentFirst = ledger => [...ledger.runs].sort((first, second) =>
  second.window.end.localeCompare(first.window.end) || first.runId.localeCompare(second.runId));

export function renderHistory(ledger) {
  return [
    '# Workflow usage history', '',
    'Times are UTC. Full scope covers the explicitly selected workflow window. Closed marks a completed workflow. Each row is the latest capture for its run ID.',
    'Cached input is part of input and reasoning is part of output. Unavailable counts may contain unmeasured usage.', '',
    '| Start date (UTC) | Captured through (UTC) | Run | Category | Scope | State | Coverage | Models and effort (responses) | Input | Cached input | Uncached input | Output | Total | Top flags |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...recentFirst(ledger).map(run => {
      const modelUsage = run.by_model.length
        ? run.by_model.map(group => (group.model ? '`' + group.model + '`' : 'Unknown model') + ' / ' + (group.effort ?? 'unknown effort')
          + ' (' + count(group.response_count) + ')').join(', ') : 'Unavailable';
      const labels = evaluate(run, ledger.runs).slice(0, 3).map(flag => flag.title).join(', ');
      const { totals } = run;
      return '| ' + [
        run.window.start.slice(0, 10), run.window.end, run.label, run.category, run.scope, run.state, run.coverage, modelUsage,
        ...['input_tokens', 'cached_input_tokens', 'uncached_input_tokens', 'output_tokens', 'total_tokens'].map(field => count(totals[field])),
        labels || 'None flagged',
      ].join(' | ') + ' |';
    }), '',
  ].join('\n');
}

export function renderFlags(ledger) {
  return [
    '# Workflow optimization flags', '',
    'Flags suggest changes to test against comparable workflows. Token counters cannot measure repeated tools or tests. Record those actions separately if repetition is under review.',
    'Each snapshot ends at the listed UTC capture bound. Later activity and unrecorded usage may be absent.', '',
    ...recentFirst(ledger).flatMap(run => {
      const flags = evaluate(run, ledger.runs);
      return [
        '## ' + run.label + ' (' + run.window.end + ')', '',
        ...(flags.length ? flags.flatMap(flag => [
          '### ' + flag.title + ' (' + flag.priority + ' · ' + flag.id + ')', '',
          '- Evidence · ' + flag.evidence,
          '- Proposed action · ' + flag.action,
          '- Verification · ' + flag.verification, '',
        ]) : ['No candidate met the thresholds for this snapshot.', '']),
      ];
    }),
  ].join('\n');
}

async function readLedger(directory) {
  const path = join(directory, jsonFile);
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return { schema_version: 1, runs: [] };
    throw new Error('Could not inspect the existing usage ledger.');
  }
  try {
    requireValid(info.isFile(), 'ledger file');
    return validateLedger(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    throw new Error('The existing usage ledger could not be read or is malformed. It was left untouched.');
  }
}

function updateLedger(ledger, run) {
  const previous = ledger.runs.find(item => item.runId === run.runId);
  if (previous) {
    const identityFields = ['category', 'label', 'scope', 'root_thread_id', 'root_turn_id'];
    if (identityFields.some(field => previous[field] !== run[field]) || previous.window.start !== run.window.start) {
      throw new Error('The run ID already belongs to a different workflow identity.');
    }
    if (previous.window.end > run.window.end) throw new Error('The capture is older than the stored snapshot.');
    if (previous.state === 'closed' && run.state !== 'closed') throw new Error('A closed run cannot be reopened.');
  }
  const otherRuns = ledger.runs.filter(item => item.runId !== run.runId);
  if (otherRuns.some(item => overlaps(run, item))) throw new Error('The selected window overlaps another run in a shared thread.');
  return { schema_version: 1, runs: [...otherRuns, run].sort((first, second) => first.runId.localeCompare(second.runId)) };
}

async function atomicWrite(directory, filename, contents) {
  const temporary = join(directory, '.usage-history-' + randomUUID() + '.tmp');
  const file = await open(temporary, 'wx', 0o600);
  try {
    try {
      await file.writeFile(contents);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, join(directory, filename));
  } finally {
    await rm(temporary, { force: true });
  }
}

async function acquireLock(directory) {
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    requireValid((await lstat(directory)).isDirectory(), 'store directory');
    return await open(join(directory, lockFile), 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('The usage store is locked by another writer or an interrupted run.');
    throw new Error('Could not open the usage store for writing.');
  }
}

export async function recordUsage({ report, runId, category, label, scope, state = 'snapshot', storeDir = '.workflow-usage' } = {}) {
  const run = runFromReport(report, { runId, category, label, scope, state });
  requireValid(typeof storeDir === 'string' && storeDir.length > 0, 'store directory');
  const directory = resolve(storeDir);
  const lock = await acquireLock(directory);
  try {
    const ledger = updateLedger(await readLedger(directory), run);
    const history = renderHistory(ledger);
    const flags = renderFlags(ledger);
    try {
      await atomicWrite(directory, jsonFile, JSON.stringify(ledger, null, 2) + '\n');
    } catch {
      throw new Error('Could not save the usage ledger.');
    }
    try {
      await atomicWrite(directory, historyFile, history);
      await atomicWrite(directory, flagsFile, flags);
    } catch {
      throw new Error('The usage ledger was saved. Repeat the command to regenerate the Markdown views.');
    }
    return { ledger, run, flags: evaluate(run, ledger.runs) };
  } finally {
    try {
      await lock.close();
      await rm(join(directory, lockFile));
    } catch {
      throw new Error('Could not release the usage store lock.');
    }
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({ options: {
      report: { type: 'string' }, 'run-id': { type: 'string' }, category: { type: 'string' },
      label: { type: 'string' }, scope: { type: 'string' }, state: { type: 'string', default: 'snapshot' }, store: { type: 'string', default: '.workflow-usage' },
    } }).values;
  } catch {
    throw new Error('Invalid command options.');
  }
  if (!args.report) throw new Error('The --report JSON path is required.');
  const pathKey = path => process.platform === 'win32' ? path.toLowerCase() : path;
  if ([jsonFile, historyFile, flagsFile, lockFile].some(file => pathKey(resolve(args.store, file)) === pathKey(resolve(args.report)))) {
    throw new Error('Use a separate JSON file for the input report.');
  }
  let report;
  try {
    report = JSON.parse((await readFile(args.report, 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Could not read the input usage report as JSON.');
  }
  const { run, flags } = await recordUsage({
    report, runId: args['run-id'], category: args.category, label: args.label, scope: args.scope, state: args.state, storeDir: args.store,
  });
  console.log('Recorded usage snapshot · ' + run.coverage + ' · ' + count(run.response_count)
    + ' responses · ' + count(run.totals.total_tokens) + ' total tokens · ' + flags.length + ' flags');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Workflow usage history: ' + error.message);
    process.exitCode = 1;
  });
}
