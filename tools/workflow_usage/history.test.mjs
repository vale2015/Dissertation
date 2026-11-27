import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { analyzeUsage, recordUsage, renderFlags, renderHistory } from './history.mjs';
import { collectUsage } from './usage.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('./history.mjs', import.meta.url));
const scratch = fileURLToPath(new URL('../../.workflow-usage/', import.meta.url));
const files = ['usage-history.json', 'USAGE_HISTORY.md', 'OPTIMIZATION_FLAGS.md'];
const uuid = value => '00000000-0000-7000-a000-' + String(value).padStart(12, '0');
const date = second => new Date(Date.UTC(2026, 10, 20, 12, 0, second)).toISOString();
const root = uuid(1);
const child = uuid(2);
const metadata = { runId: 'rfs68-initial', category: 'tooling', label: 'Token agent initial', scope: 'full', state: 'closed' };
const secret = 'PRIVATE_REPORT_CONTENT_SENTINEL';

function totals(input, output) {
  return {
    input_tokens: input, cached_input_tokens: input / 2, uncached_input_tokens: input / 2,
    cache_write_input_tokens: 0, output_tokens: output, reasoning_output_tokens: 30, total_tokens: input + output,
  };
}

function report({
  start = 0, end = 10, thread = root, turn = null, input = 500_000, output = 10_000, responses = 10,
  coverage = 'observed',
} = {}) {
  const usage = { response_count: responses, totals: totals(input, output) };
  return {
    schema_version: 1,
    root_thread_id: thread,
    root_turn_id: turn,
    window: { start: date(start), end: date(end) },
    ...usage,
    by_thread: [{ thread_id: thread, parent_thread_id: null, ...usage }],
    by_model: [{ model: 'test-model', effort: 'medium', ...usage }],
    coverage: { status: coverage, source: 'claude_code_transcript_usage' },
  };
}

async function fixture(t) {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(join(scratch, 'history-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storeDir = join(directory, 'store');
  return {
    directory,
    storeDir,
    record: (data, options = {}) => recordUsage({ ...metadata, report: data, storeDir, ...options }),
    read: () => Promise.all(files.map(file => readFile(join(storeDir, file), 'utf8'))),
  };
}

test('keeps two runs, replaces a refreshed run once, and closes without reopening', async t => {
  const log = await fixture(t);
  await log.record(report({ end: 5 }), { state: 'snapshot' });
  await log.record(report({ start: 10, end: 20, input: 80_000 }), { runId: 'other', label: 'Another workflow' });
  await log.record(report({ input: 600_000 }), { state: 'closed' });
  const first = await log.read();
  await log.record(report({ input: 600_000 }));
  assert.deepEqual(await log.read(), first);
  const [json, history, flags] = first;
  assert.deepEqual(JSON.parse(json).runs.map(run => [run.runId, run.totals.total_tokens]),
    [['other', 90_000], [metadata.runId, 610_000]]);
  assert.equal((history.match(/Token agent initial/g) ?? []).length, 1);
  assert.match(history, /2026-11-20.*Another workflow.*80,000.*40,000.*40,000.*10,000.*90,000/);
  assert.match(history, /test-model.*medium \(10\)/);
  assert.match(flags, /repeat(?:ed)? tools or tests/i);
  for (const options of [
    { scope: 'partial' }, { category: 'another' }, { label: 'Another label' },
  ]) {
    await assert.rejects(log.record(report(), options), /different workflow identity/);
  }
  await assert.rejects(log.record(report({ end: 9 })), /older than/);
  await assert.rejects(log.record(report({ start: 1 })), /different workflow identity/);
  await assert.rejects(log.record(report({ thread: child })), /different workflow identity/);
  await assert.rejects(log.record(report({ turn: uuid(9) })), /different workflow identity/);
  await assert.rejects(log.record(report(), { state: 'snapshot' }), /cannot be reopened/);
  assert.deepEqual(await log.read(), first);
});

test('rejects intersecting windows including inherited threads and allows disjoint half-open windows or turn filters', async t => {
  const log = await fixture(t);
  const first = report({ turn: uuid(7), responses: 5 });
  first.by_thread[0] = { ...first.by_thread[0], response_count: 0,
    totals: Object.fromEntries(Object.keys(first.totals).map(field => [field, null])) };
  first.by_thread.push({ ...first.by_model[0], thread_id: child, parent_thread_id: root });
  await log.record(first, { runId: root });
  await assert.rejects(log.record(report({ thread: child }), { runId: 'descendant' }), /overlaps/);
  await assert.rejects(log.record(report({ turn: uuid(7) }), { runId: 'same-turn' }), /overlaps/);
  await log.record(report({ thread: child, turn: uuid(8) }), { runId: 'other-turn' });
  await log.record(report({ start: 10, end: 20 }), { runId: 'next-window' });
  await assert.rejects(log.record({ ...first, window: { start: date(0), end: date(11) } }, { runId: root }), /overlaps/);
  assert.equal(JSON.parse((await log.read())[0]).runs.length, 3);
});

test('limits derived files to validated labels and allowlisted counters', async t => {
  const log = await fixture(t);
  const data = report();
  data.raw_transcript = secret;
  data.window.rollout_path = 'C:/private/' + secret;
  data.coverage.note = secret;
  data.by_thread[0].content = secret;
  data.by_model[0].cwd = secret;
  data.totals.payload = secret;
  await log.record(data);
  const originals = await log.read();
  for (const content of originals) {
    assert.doesNotMatch(content, new RegExp(secret + '|C:/private'));
  }
  assert.doesNotMatch(originals[1] + originals[2], new RegExp(root));
  await assert.rejects(log.record(data, { label: '[link](https://example.test)' }), /label/);
  await assert.rejects(log.record(data, { label: 'Another label\n' }), /label/);
  await assert.rejects(log.record(data, { category: '../private' }), /category/);
  await assert.rejects(log.record({ ...data, schema_version: 2 }), /report schema/);
  await assert.rejects(log.record({ ...data, totals: { ...data.totals, total_tokens: -1 } }), /total_tokens/);
  assert.deepEqual(await log.read(), originals);
});

test('keeps a malformed ledger and a held lock intact', async t => {
  const log = await fixture(t);
  await log.record(report());
  const ledger = join(log.storeDir, files[0]);
  const lock = join(log.storeDir, '.usage-history.lock');
  const held = await log.read();
  await writeFile(lock, 'held');
  await assert.rejects(log.record(report({ end: 20 })), /locked by another writer/);
  assert.equal(await readFile(lock, 'utf8'), 'held');
  assert.deepEqual(await log.read(), held);
  await rm(lock);
  for (const corrupt of ['{incomplete', JSON.stringify({ schema_version: 1, runs: [{ secret }] })]) {
    await writeFile(ledger, corrupt);
    await assert.rejects(log.record(report()), /malformed/);
    assert.deepEqual(await log.read(), [corrupt, ...held.slice(1)]);
  }
});

test('two concurrent writers cannot both race a ledger update', async t => {
  const log = await fixture(t);
  await mkdir(log.storeDir);
  const results = await Promise.allSettled([
    log.record(report(), { runId: 'first' }),
    log.record(report({ start: 10, end: 20 }), { runId: 'second' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(results.find(result => result.status === 'rejected').reason.message, /locked/);
  assert.equal(JSON.parse((await log.read())[0]).runs.length, 1);
  assert.deepEqual((await readdir(log.storeDir)).sort(), [...files].sort());
});

test('retains authority if one Markdown view fails, and rebuilds the views on retry', async t => {
  const log = await fixture(t);
  const blocked = join(log.storeDir, files[2]);
  await mkdir(blocked, { recursive: true });
  await assert.rejects(log.record(report()), /ledger was saved/);
  const before = await readFile(join(log.storeDir, files[0]), 'utf8');
  assert.equal(JSON.parse(before).runs.length, 1);
  await rm(blocked, { recursive: true });
  await log.record(report());
  const [json, history, flags] = await log.read();
  assert.equal(json, before);
  assert.equal(history, renderHistory(JSON.parse(before)));
  assert.equal(flags, renderFlags(JSON.parse(before)));
});

test('propagates unavailable totals, preserves observed zero and labels measured thresholds', async t => {
  const log = await fixture(t);
  const data = report({ coverage: 'partial' });
  const partial = { input_tokens: 500_000, cached_input_tokens: 0, uncached_input_tokens: 500_000,
    cache_write_input_tokens: null, output_tokens: 10_000, reasoning_output_tokens: null, total_tokens: null };
  for (const item of [data, ...data.by_thread, ...data.by_model]) item.totals = partial;
  const result = await log.record(data, { scope: 'partial', state: 'snapshot' });
  assert.deepEqual(result.flags.map(flag => flag.id),
    ['large-average-input', 'coordinator-majority-input', 'telemetry-coverage', 'baseline-insufficient']);
  assert.ok(result.flags.every(flag => flag.evidence && flag.action && flag.verification));
  assert.deepEqual(result.run.totals, partial);
  assert.match(renderHistory(result.ledger), /500,000 \| 0 \| 500,000 \| 10,000 \| Unavailable/);
  const missing = report({ start: 10, end: 20, coverage: 'unavailable' });
  missing.response_count = 0;
  missing.totals = Object.fromEntries(Object.keys(missing.totals).map(field => [field, null]));
  missing.by_thread = [];
  missing.by_model = [];
  const unavailable = await log.record(missing, { runId: 'missing' });
  assert.equal(unavailable.run.totals.total_tokens, null);
  assert.deepEqual(unavailable.flags.map(flag => flag.id), ['telemetry-coverage', 'baseline-insufficient']);
});

test('rejects numeric uncached input when either operand is unavailable', async t => {
  const log = await fixture(t);
  await log.record(report());
  const stored = await log.read();
  for (const tokens of [
    { input_tokens: 100, cached_input_tokens: null, uncached_input_tokens: 900 },
    { input_tokens: null, cached_input_tokens: 0, uncached_input_tokens: 100 },
  ]) {
    const data = report({ start: 10, end: 20, coverage: 'partial' });
    for (const item of [data, ...data.by_thread, ...data.by_model]) {
      item.totals = { ...item.totals, ...tokens, total_tokens: null };
    }
    await assert.rejects(log.record(data, { runId: 'invalid' }), /input subsets/);
  }
  assert.deepEqual(await log.read(), stored);
});

test('baseline needs three earlier full, closed and observed runs in the same category and selection type', async t => {
  const log = await fixture(t);
  for (const [index, options] of [
    [0, {}],
    [1, {}],
    [2, { state: 'snapshot' }],
    [3, { scope: 'partial' }],
    [4, { category: 'other' }],
    [5, { coverage: 'partial' }],
    [6, { turn: uuid(11) }],
    [9, {}],
  ]) {
    const { coverage, turn, ...identity } = options;
    await log.record(report({ start: index * 10, end: index * 10 + 10, input: 70_000, coverage, turn }),
      { runId: 'baseline-' + index, ...identity });
  }
  const current = report({ start: 70, end: 80, input: 200_000 });
  const next = { ...metadata, runId: 'current' };
  const previous = JSON.parse((await log.read())[0]).runs;
  assert.deepEqual(analyzeUsage(current, previous, next).map(flag => flag.id), ['baseline-insufficient']);
  const { ledger } = await log.record(report({ start: 20, end: 30, input: 70_000 }), { runId: 'baseline-2' });
  assert.deepEqual(analyzeUsage(current, ledger.runs, { ...next, state: 'snapshot' }).map(flag => flag.id),
    ['baseline-insufficient']);
  assert.deepEqual(analyzeUsage(report({ start: 70, end: 80, input: 110_000 }), ledger.runs, next), []);
  const flags = analyzeUsage(current, ledger.runs, next);
  assert.deepEqual(flags.map(flag => flag.id), ['above-category-baseline']);
  assert.match(flags[0].evidence, /210,000.*80,000.*3 prior comparable runs/);
});

test('CLI consumes a JSON report from the collector without modifying it', async t => {
  const log = await fixture(t);
  const projects = join(log.directory, 'projects');
  await mkdir(join(projects, 'project'), { recursive: true });
  await writeFile(join(projects, 'project', root + '.jsonl'), [
    { type: 'user', timestamp: date(1), sessionId: root, cwd: secret, message: { content: secret } },
    // Anthropic usage: 5,000 uncached + 5,000 cache read = 10,000 normalized input.
    { type: 'assistant', timestamp: date(2), sessionId: root, requestId: 'ignored-id', effort: 'low',
      message: { model: 'test-model', content: [{ type: 'text', text: secret }], usage: {
        input_tokens: 5_000, cache_read_input_tokens: 5_000, cache_creation_input_tokens: 0,
        output_tokens: 1_000, output_tokens_details: { thinking_tokens: 30 } } } },
  ].map(line => JSON.stringify(line)).join('\n'));
  const data = await collectUsage({ rootThreadId: root, since: date(0), until: date(10), transcriptDir: projects });
  const path = join(log.directory, 'current.json');
  const content = JSON.stringify(data);
  await writeFile(path, content);
  const call = (...args) => exec(process.execPath, [cli, '--report', path, '--run-id', 'fixture', '--category', 'tooling',
    '--label', 'CLI workflow', '--scope', 'partial', '--store', log.storeDir, ...args]);
  const { stdout, stderr } = await call();
  assert.equal(stderr, '');
  assert.match(stdout, /observed · 1 responses · 11,000 total tokens/);
  assert.equal(await readFile(path, 'utf8'), content);
  const outputs = await log.read();
  assert.equal(JSON.parse(outputs[0]).runs[0].state, 'snapshot');
  assert.doesNotMatch(outputs.join(''), new RegExp(secret + '|ignored-id'));
  await assert.rejects(call('--label', '\x60' + secret + '\x60'), error => {
    assert.equal(error.code, 1);
    assert.doesNotMatch(error.stderr, new RegExp(secret));
    return true;
  });
  assert.deepEqual(await log.read(), outputs);
});

test('accepts Claude Code and legacy Codex report sources but rejects an unknown source', async t => {
  const log = await fixture(t);
  const withSource = (source, start) => {
    const data = report({ start, end: start + 5 });
    data.coverage.source = source;
    return data;
  };
  await log.record(withSource('claude_code_transcript_usage', 0), { runId: 'claude-source' });
  const { ledger } = await log.record(withSource('codex_rollout_token_usage_record', 10), { runId: 'legacy-source' });
  assert.deepEqual(ledger.runs.map(run => run.runId).sort(), ['claude-source', 'legacy-source']);
  const before = await log.read();
  await assert.rejects(log.record(withSource('unknown_usage_source', 20), { runId: 'unknown-source' }), /coverage source/);
  assert.deepEqual(await log.read(), before);
});
