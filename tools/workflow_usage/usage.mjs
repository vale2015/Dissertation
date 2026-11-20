import { constants, createReadStream } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const namePattern = /^[a-z\d][a-z\d._-]{0,63}$/i;
const responsePattern = /^[a-z\d][a-z\d._-]{0,255}$/i;
const efforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const fields = [
  'input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens',
  'reasoning_output_tokens', 'total_tokens', 'uncached_input_tokens',
];
const coverageNote = 'Counts reflect deduplicated response records present in local rollouts at capture. Missing sessions, unrecorded requests and later writes may be absent.';

function uuid(value) {
  return typeof value === 'string' && uuidPattern.test(value) ? value.toLowerCase() : null;
}

function timestamp(value) {
  if (typeof value !== 'string') return NaN;
  const parts = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return NaN;
  const day = new Date(parts[1]);
  if (!Number.isFinite(day.getTime()) || !day.toISOString().startsWith(parts[1])) return NaN;
  return Date.parse(value);
}

function isWithin(path, root) {
  const suffix = relative(root, path);
  return !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('..' + sep);
}

async function openRollout(path, root) {
  if (!(await lstat(path)).isFile() || !isWithin(await realpath(path), root)) {
    throw new Error('Rollout is outside the selected directory or is not a regular file.');
  }
  return open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
}

async function readHeader(path, root) {
  const file = await openRollout(path, root);
  try {
    const buffer = Buffer.alloc(128 * 1024);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, Math.min(4096, buffer.length - length));
      if (bytesRead === 0) break;
      const end = buffer.subarray(length, length + bytesRead).indexOf(10);
      if (end !== -1) {
        return JSON.parse(buffer.toString('utf8', 0, length + end).replace(/^\uFEFF/, ''));
      }
      length += bytesRead;
    }
    return JSON.parse(buffer.toString('utf8', 0, length).replace(/^\uFEFF/, ''));
  } finally {
    await file.close();
  }
}

async function discoverSessions(dir, coverage) {
  const sessions = new Map();
  let root;
  try {
    if (!(await lstat(dir)).isDirectory()) {
      coverage.discovery_errors++;
      return { sessions };
    }
    root = await realpath(dir);
  } catch (error) {
    if (error.code !== 'ENOENT') coverage.discovery_errors++;
    return { sessions };
  }
  coverage.rollout_directory_found = true;

  const remaining = [root];
  while (remaining.length) {
    const directory = remaining.pop();
    let entries;
    try {
      if (!(await lstat(directory)).isDirectory() || !isWithin(await realpath(directory), root)) {
        coverage.discovery_errors++;
        continue;
      }
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      coverage.discovery_errors++;
      continue;
    }
    entries.sort((a, b) => a.name < b.name ? -1 : Number(a.name !== b.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) remaining.push(path);
      if (!entry.isFile() || !/^rollout-.*\.jsonl$/.test(entry.name)) continue;

      let header;
      try {
        header = await readHeader(path, root);
      } catch {
        coverage.unreadable_or_invalid_headers++;
        continue;
      }
      const meta = header?.payload;
      const id = uuid(meta?.id);
      if (header?.type !== 'session_meta' || id === null) {
        coverage.unreadable_or_invalid_headers++;
        continue;
      }

      const directParent = uuid(meta.parent_thread_id);
      const spawnParent = uuid(meta.source?.subagent?.thread_spawn?.parent_thread_id);
      const parent = spawnParent ?? directParent;
      const files = sessions.get(id) ?? [];
      files.push({ path, parent, created: timestamp(header.timestamp), parentConflict: Boolean(spawnParent && directParent && spawnParent !== directParent) });
      sessions.set(id, files);
    }
  }
  return { root, sessions };
}

function familyOf(sessions, rootThreadId, coverage) {
  if (!sessions.has(rootThreadId)) return [];
  const children = new Map();
  for (const [id, files] of sessions) {
    const parents = new Set(files.map(file => file.parent));
    if (parents.size !== 1 || files.some(file => file.parentConflict)) {
      coverage.ambiguous_thread_links++;
      if (id !== rootThreadId) continue;
    }
    const [parent] = parents;
    const siblings = children.get(parent) ?? [];
    siblings.push(id);
    children.set(parent, siblings);
  }

  const family = [{ id: rootThreadId, parent: null, files: sessions.get(rootThreadId) }];
  const seen = new Set([rootThreadId]);
  for (const { id } of family) {
    for (const child of (children.get(id) ?? []).sort()) {
      if (seen.has(child)) continue;
      seen.add(child);
      family.push({ id: child, parent: id, files: sessions.get(child) });
    }
  }
  return family;
}

function tokenNumber(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeUsage(usage) {
  const totals = Object.fromEntries(fields.map(field => [field, tokenNumber(usage[field])]));
  const input = totals.input_tokens;
  const output = totals.output_tokens;
  if (input !== null && totals.cached_input_tokens > input) totals.cached_input_tokens = null;
  if (output !== null && totals.reasoning_output_tokens > output) totals.reasoning_output_tokens = null;
  if (input !== null && output !== null && totals.total_tokens !== input + output) totals.total_tokens = null;
  totals.uncached_input_tokens = input !== null && totals.cached_input_tokens !== null
    ? input - totals.cached_input_tokens : null;
  return totals;
}

function scopeIncludes(date, rootTurn, scope) {
  return date >= scope.start && date < scope.end && (scope.turnId === undefined || rootTurn === scope.turnId);
}

async function scanThread(thread, rolloutRoot, scope, coverage) {
  const responses = new Map();
  let relevant = false;
  let malformed = false;
  let legacy = false;
  for (const { path, created } of thread.files) {
    relevant ||= scopeIncludes(created, null, scope);
    let input;
    let lines;
    try {
      input = (await openRollout(path, rolloutRoot)).createReadStream();
      lines = createInterface({ input, crlfDelay: Infinity });
      let context = { turn: null, rootTurn: null, model: null, effort: null };
      for await (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line.replace(/^\uFEFF/, ''));
        } catch {
          coverage.malformed_json_lines++;
          malformed = true;
          continue;
        }
        const data = entry?.payload;
        if (entry?.type === 'turn_context') {
          context = {
            turn: uuid(data?.turn_id),
            rootTurn: uuid(data?.root_turn_id),
            model: typeof data?.model === 'string' && namePattern.test(data.model) ? data.model : null,
            effort: efforts.has(data?.effort) ? data.effort : null,
          };
          relevant ||= scopeIncludes(timestamp(entry.timestamp), context.rootTurn, scope);
          continue;
        }
        if (entry?.type === 'event_msg' && data?.type === 'token_count') {
          legacy ||= scopeIncludes(timestamp(entry.timestamp), context.rootTurn, scope);
          continue;
        }
        if (entry?.type !== 'token_usage_record') continue;

        const date = timestamp(entry.timestamp);
        const rootTurn = uuid(data?.root_turn_id);
        if (!Number.isFinite(date)) {
          coverage.invalid_response_records++;
          malformed = true;
          continue;
        }
        if (date >= scope.end) continue;
        if (scope.turnId !== undefined && rootTurn === null && date >= scope.start) {
          coverage.records_missing_root_turn++;
        }
        const inScope = scopeIncludes(date, rootTurn, scope);
        relevant ||= inScope;
        const { response_id: responseId, usage } = data ?? {};
        if (uuid(data?.thread_id) !== thread.id || typeof responseId !== 'string' || !responsePattern.test(responseId)
          || !usage || typeof usage !== 'object' || Array.isArray(usage)) {
          if (inScope) coverage.invalid_response_records++;
          continue;
        }
        const matchingContext = context.turn === null || context.turn === uuid(data.turn_id);
        const response = {
          date,
          rootTurn,
          model: matchingContext ? context.model : null,
          effort: matchingContext ? context.effort : null,
          totals: normalizeUsage(usage),
        };
        const previous = responses.get(responseId);
        if (!previous) {
          responses.set(responseId, { response, duplicates: 0, conflicted: false });
          continue;
        }
        previous.duplicates++;
        previous.conflicted ||= response.rootTurn !== previous.response.rootTurn
          || fields.some(field => response.totals[field] !== previous.response.totals[field]);
        if (date < previous.response.date) previous.response = response;
      }
    } catch {
      coverage.unreadable_selected_rollouts++;
      malformed = true;
    } finally {
      lines?.close();
      input?.destroy();
    }
  }

  const observed = [];
  for (const { response, duplicates, conflicted } of responses.values()) {
    if (!scopeIncludes(response.date, response.rootTurn, scope)) continue;
    coverage.duplicate_response_records += duplicates;
    if (conflicted) coverage.conflicting_response_ids++;
    else observed.push(response);
  }
  if (legacy && observed.length === 0) coverage.legacy_only_threads++;
  return { relevant: relevant || legacy || malformed, observed };
}

function aggregate(responses) {
  const totals = Object.fromEntries(fields.map(field => [field, responses.length ? 0 : null]));
  for (const response of responses) {
    for (const field of fields) {
      const value = response.totals[field];
      totals[field] = totals[field] === null || value === null ? null : tokenNumber(totals[field] + value);
    }
  }
  return { response_count: responses.length, totals };
}

export async function collectUsage({ rolloutDir = join(homedir(), '.codex', 'sessions'), rootThreadId,
  since, until = new Date().toISOString(), turnId } = {}) {
  const rootId = uuid(rootThreadId);
  if (rootId === null) throw new Error('A valid root thread UUID is required.');
  const normalizedTurnId = turnId === undefined ? undefined : uuid(turnId);
  if (normalizedTurnId === null) throw new Error('The turn filter must be a valid UUID.');
  const scope = { start: timestamp(since), end: timestamp(until), turnId: normalizedTurnId };
  if (!Number.isFinite(scope.start) || !Number.isFinite(scope.end) || scope.start >= scope.end) {
    throw new Error('Supply ISO 8601 timestamps with explicit time zones and an end after the start.');
  }
  if (typeof rolloutDir !== 'string' || rolloutDir.length === 0) throw new Error('A rollout directory is required.');

  const coverage = {
    source: 'codex_rollout_token_usage_record',
    status: 'unavailable',
    rollout_directory_found: false,
    root_thread_found: false,
    discovery_errors: 0,
    unreadable_or_invalid_headers: 0,
    ambiguous_thread_links: 0,
    unreadable_selected_rollouts: 0,
    malformed_json_lines: 0,
    invalid_response_records: 0,
    records_missing_root_turn: 0,
    duplicate_response_records: 0,
    conflicting_response_ids: 0,
    legacy_only_threads: 0,
    threads_without_usage: 0,
    unknown_model_responses: 0,
    unknown_effort_responses: 0,
    missing_fields: Object.fromEntries(fields.map(field => [field, 0])),
    note: coverageNote,
  };
  const { root, sessions } = await discoverSessions(resolve(rolloutDir), coverage);
  const family = familyOf(sessions, rootId, coverage);
  coverage.root_thread_found = family.length > 0;
  const byThread = [];
  const byModel = new Map();
  const allResponses = [];
  for (const thread of family) {
    const { relevant, observed } = await scanThread(thread, root, scope, coverage);
    if (!relevant && thread.id !== rootId) continue;
    byThread.push({ thread_id: thread.id, parent_thread_id: thread.parent, ...aggregate(observed) });
    if (!observed.length) coverage.threads_without_usage++;
    for (const response of observed) {
      allResponses.push(response);
      const { model, effort, totals } = response;
      if (model === null) coverage.unknown_model_responses++;
      if (effort === null) coverage.unknown_effort_responses++;
      for (const field of fields) {
        if (totals[field] === null) coverage.missing_fields[field]++;
      }
      const key = JSON.stringify([model, effort]);
      const group = byModel.get(key) ?? { model, effort, responses: [] };
      group.responses.push(response);
      byModel.set(key, group);
    }
  }

  const overall = aggregate(allResponses);
  const incomplete = [
    coverage.discovery_errors, coverage.unreadable_or_invalid_headers, coverage.ambiguous_thread_links,
    coverage.unreadable_selected_rollouts, coverage.malformed_json_lines, coverage.invalid_response_records,
    coverage.records_missing_root_turn, coverage.conflicting_response_ids, coverage.legacy_only_threads,
    coverage.threads_without_usage, coverage.unknown_model_responses, coverage.unknown_effort_responses,
    ...Object.values(coverage.missing_fields),
  ].some(Boolean) || fields.some(field => overall.totals[field] === null);
  const hasTokenCounts = allResponses.some(response => fields.some(field => response.totals[field] !== null));
  if (hasTokenCounts) coverage.status = incomplete ? 'partial' : 'observed';
  return {
    schema_version: 1,
    root_thread_id: rootId,
    root_turn_id: normalizedTurnId ?? null,
    window: { start: new Date(scope.start).toISOString(), end: new Date(scope.end).toISOString() },
    ...overall,
    by_thread: byThread,
    by_model: [...byModel.keys()].sort().map(key => {
      const { model, effort, responses } = byModel.get(key);
      return { model, effort, ...aggregate(responses) };
    }),
    coverage,
  };
}

export function renderMarkdown(report) {
  const count = value => value ?? 'Unavailable';
  const columns = '| Responses | Input | Cached input | Cache write input | Uncached input | Output | Reasoning output | Total |';
  const separators = '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
  const row = ({ response_count, totals }) => [
    response_count, totals.input_tokens, totals.cached_input_tokens, totals.cache_write_input_tokens,
    totals.uncached_input_tokens, totals.output_tokens, totals.reasoning_output_tokens, totals.total_tokens,
  ].map(count).join(' | ') + ' |';
  const coverage = report.coverage;
  const warnings = [
    !coverage.rollout_directory_found && '- Local rollout directory was unavailable.',
    !coverage.root_thread_found && '- Root thread metadata was unavailable.',
    (coverage.discovery_errors || coverage.unreadable_or_invalid_headers || coverage.ambiguous_thread_links)
      && '- Some session headers or lineage could not be verified.',
    coverage.unreadable_selected_rollouts && '- Some selected rollouts could not be read.',
    (coverage.malformed_json_lines || coverage.invalid_response_records || coverage.conflicting_response_ids)
      && '- Some malformed or conflicting records were skipped.',
    coverage.records_missing_root_turn && '- Some records could not be assigned to the selected root turn.',
    coverage.legacy_only_threads && '- Some threads exposed only unsupported cumulative token counters.',
    coverage.threads_without_usage && '- Some selected threads had no response usage records in this window.',
    (coverage.unknown_model_responses || coverage.unknown_effort_responses)
      && '- Some responses lacked model or effort attribution.',
    Object.values(coverage.missing_fields).some(Boolean) && '- Some token fields were unavailable in the response records.',
  ].filter(Boolean);
  return [
    '# Codex workflow token usage', '', 'Root thread · ' + report.root_thread_id,
    ...(report.root_turn_id ? ['Root turn · ' + report.root_turn_id] : []),
    'Window (start inclusive, end exclusive) · ' + report.window.start + ' to ' + report.window.end,
    'Telemetry coverage · ' + coverage.status, '', coverage.note,
    'Cached input and reasoning output are included in their respective input and output counts.', '',
    ...warnings, ...(warnings.length ? [''] : []),
    '## Workflow totals', '', columns, separators, '| ' + row(report), '',
    '## By thread', '', '| Thread | Parent ' + columns, '| --- | --- ' + separators,
    ...report.by_thread.map(thread => '| ' + thread.thread_id + ' | ' + (thread.parent_thread_id ?? 'Root') + ' | ' + row(thread)), '',
    '## By recorded model and effort', '', '| Model | Effort ' + columns, '| --- | --- ' + separators,
    ...report.by_model.map(group => '| ' + (group.model ?? 'Unknown') + ' | ' + (group.effort ?? 'Unknown') + ' | ' + row(group)), '',
  ].join('\n');
}

async function writeReport(path, content) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, '.workflow-usage-' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({ options: {
      thread: { type: 'string' }, since: { type: 'string' }, until: { type: 'string' }, turn: { type: 'string' },
      'rollout-dir': { type: 'string' }, output: { type: 'string' }, markdown: { type: 'string' },
    } }).values;
  } catch {
    throw new Error('Invalid command options.');
  }
  if (!args.output) throw new Error('The --output JSON path is required.');
  const output = resolve(args.output);
  const markdown = args.markdown ? resolve(args.markdown) : null;
  const pathKey = path => process.platform === 'win32' ? path.toLowerCase() : path;
  if (markdown && pathKey(markdown) === pathKey(output)) {
    throw new Error('Use different paths for the JSON and Markdown reports.');
  }
  const report = await collectUsage({
    rolloutDir: args['rollout-dir'], rootThreadId: args.thread, since: args.since, until: args.until, turnId: args.turn,
  });
  try {
    await writeReport(output, JSON.stringify(report, null, 2) + '\n');
    if (markdown) await writeReport(markdown, renderMarkdown(report));
  } catch {
    throw new Error('Could not write the requested report files.');
  }
  console.log('Workflow usage: ' + report.coverage.status + ' · ' + report.response_count
    + ' responses · ' + (report.totals.total_tokens ?? 'unavailable') + ' total tokens');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Workflow usage: ' + error.message);
    process.exitCode = 1;
  });
}
