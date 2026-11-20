import { lstat, mkdir, open, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { recordUsage } from './history.mjs';
import { collectUsage, renderMarkdown, writeReport } from './usage.mjs';

const runIdPattern = /^[a-z\d][a-z\d_-]{0,63}$/;
const deviceName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
const lockName = '.usage-capture.lock';

async function checkPath(path, expectedType) {
  let details;
  try {
    details = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error('Could not inspect the capture store or output paths.');
  }
  const valid = expectedType === 'directory' ? details.isDirectory() : details.isFile() && details.nlink === 1;
  if (!valid) throw new Error('A capture output path is occupied by an incompatible file, directory or link.');
}

async function lockStore(store) {
  try {
    await checkPath(store, 'directory');
    await mkdir(store, { recursive: true, mode: 0o700 });
    return await open(join(store, lockName), 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('The capture store is locked by another capture or an interrupted run.');
    if (!error.code) throw error;
    throw new Error('Could not open the capture store for writing.');
  }
}

function analystBrief(report, { run, flags, ledger }) {
  const {
    source, status, rollout_directory_found, root_thread_found, discovery_errors, unreadable_or_invalid_headers,
    ambiguous_thread_links, unreadable_selected_rollouts, malformed_json_lines, invalid_response_records,
    records_missing_root_turn, duplicate_response_records, conflicting_response_ids, legacy_only_threads,
    threads_without_usage, unknown_model_responses, unknown_effort_responses, missing_fields, note,
  } = report.coverage;

  // Match the prior-record eligibility rule used by the history flags.
  const comparableCount = ledger.runs.filter(other => other.runId !== run.runId && other.category === run.category
    && other.scope === 'full' && other.state === 'closed' && other.coverage === 'observed' && other.totals.total_tokens !== null
    && Boolean(other.root_turn_id) === Boolean(run.root_turn_id) && other.window.end < run.window.end).length;

  return {
    schema_version: 1,
    run_id: run.runId,
    category: run.category,
    scope: run.scope,
    state: run.state,
    window: run.window,
    selection_type: run.root_turn_id ? 'root_turn' : 'time_window',
    response_count: run.response_count,
    totals: run.totals,
    root_input_tokens: run.root_input_tokens,
    by_model: run.by_model,
    coverage: {
      source, status, rollout_directory_found, root_thread_found, discovery_errors, unreadable_or_invalid_headers,
      ambiguous_thread_links, unreadable_selected_rollouts, malformed_json_lines, invalid_response_records,
      records_missing_root_turn, duplicate_response_records, conflicting_response_ids, legacy_only_threads,
      threads_without_usage, unknown_model_responses, unknown_effort_responses, missing_fields, note,
    },
    flags,
    prior_comparable_category_records: comparableCount,
  };
}

const json = value => JSON.stringify(value, null, 2) + '\n';

async function captureUsage({ rolloutDir, rootThreadId, since, until, turnId,
  runId, category, label, scope, state, storeDir = '.workflow-usage' }) {
  if (typeof runId !== 'string' || runIdPattern.exec(runId)?.[0] !== runId || deviceName.test(runId)) {
    throw new Error('Use a run ID of up to 64 lowercase letters, digits, hyphens or underscores, starting with a letter or digit.');
  }
  if (storeDir.length === 0) throw new Error('A capture store directory is required.');
  const store = resolve(storeDir);
  const report = await collectUsage({ rolloutDir, rootThreadId, since, until, turnId });

  // Hold the capture lock through publication so two captures cannot publish out of ledger order.
  const lock = await lockStore(store);
  let recorded = false;
  try {
    const reports = join(store, 'reports');
    const briefs = join(store, 'briefs');
    const reportJson = join(reports, runId + '.json');
    const reportMarkdown = join(reports, runId + '.md');
    const briefJson = join(briefs, runId + '.json');
    await checkPath(reports, 'directory');
    await checkPath(briefs, 'directory');
    for (const path of [reportJson, reportMarkdown, briefJson]) await checkPath(path, 'file');

    const update = await recordUsage({ report, runId, category, label, scope, state, storeDir: store });
    recorded = true;
    const brief = analystBrief(report, update);
    try {
      await writeReport(reportJson, json(report));
      await writeReport(reportMarkdown, renderMarkdown(report));
      await writeReport(briefJson, json(brief));
    } catch {
      throw new Error('The usage ledger was saved. Some capture files may be stale or missing. Repeat the capture with the same run ID to regenerate them.');
    }
    return brief;
  } finally {
    try {
      await lock.close();
      await rm(join(store, lockName));
    } catch {
      throw new Error((recorded ? 'The usage ledger was saved. ' : '') + 'Could not release the capture store lock.');
    }
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({ options: {
      thread: { type: 'string' }, since: { type: 'string' }, until: { type: 'string' }, turn: { type: 'string' },
      'run-id': { type: 'string' }, category: { type: 'string' }, label: { type: 'string' }, scope: { type: 'string' },
      state: { type: 'string' }, 'rollout-dir': { type: 'string' }, store: { type: 'string' },
    } }).values;
  } catch {
    throw new Error('Invalid capture options.');
  }
  const brief = await captureUsage({
    rootThreadId: args.thread, since: args.since, until: args.until, turnId: args.turn, runId: args['run-id'],
    category: args.category, label: args.label, scope: args.scope, state: args.state,
    rolloutDir: args['rollout-dir'], storeDir: args.store,
  });
  const tokens = value => value ?? 'unavailable';
  const totals = brief.totals;
  console.log('Run ' + brief.run_id + ' | Coverage ' + brief.coverage.status + ' (' + brief.scope + ', ' + brief.state + ')');
  console.log('Responses ' + brief.response_count + ' | Total tokens ' + tokens(totals.total_tokens));
  console.log('Cached input ' + tokens(totals.cached_input_tokens) + ' | Uncached input '
    + tokens(totals.uncached_input_tokens) + ' | Output ' + tokens(totals.output_tokens));
  console.log('Flags ' + (brief.flags.map(flag => flag.id).join(', ') || 'none'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Workflow usage capture: ' + error.message);
    process.exitCode = 1;
  });
}
