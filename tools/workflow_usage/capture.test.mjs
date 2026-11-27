import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { subagentThreadId } from './usage.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('./capture.mjs', import.meta.url));
const scratch = fileURLToPath(new URL('../../.workflow-usage/capture-tests/', import.meta.url));
const id = number => '00000000-0000-7000-a000-' + String(number).padStart(12, '0');
const [root, unrelated, turn] = [1, 3, 4].map(id);
const child = subagentThreadId(root, 'specialist01');
const time = second => '2026-11-20T18:00:' + String(second).padStart(2, '0') + '.000Z';
const privateData = 'SYNTHETIC_PRIVATE_VALUE';
// Anthropic usage shape; normalizes to 100 input (75 cached, 5 cache write), 40 output (20 thinking).
const tokens = {
  input_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 75,
  output_tokens: 40, output_tokens_details: { thinking_tokens: 20 },
};

let currentModel = new Map();
const session = (thread, model) => {
  currentModel.set(thread, model);
  return [{ type: 'user', timestamp: time(1), sessionId: thread, promptId: turn, cwd: 'C:/private/' + privateData,
    message: { role: 'user', content: privateData } }];
};
const usage = (thread, second, counts = tokens, model = currentModel.get(thread)) => ({
  type: 'assistant', timestamp: time(second), sessionId: thread, requestId: 'private_response_' + second, effort: 'medium',
  message: { id: 'msg_private', model, content: [{ type: 'text', text: privateData }], usage: counts },
});

async function fixture(t) {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(join(scratch, 'run-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const transcriptDir = join(directory, 'projects');
  const project = join(transcriptDir, 'private-project');
  const store = join(directory, 'store');
  await mkdir(join(project, root, 'subagents'), { recursive: true });
  const transcript = (path, lines) => writeFile(join(project, ...path), lines.map(line => JSON.stringify(line)).join('\n'));
  const rootRollout = (...rows) => transcript([root + '.jsonl'], [...session(root, 'coordinator'), ...rows]);
  await Promise.all([
    rootRollout(usage(root, 2, tokens, 'coordinator'), usage(root, 2, tokens, 'coordinator')),
    transcript([root, 'subagents', 'agent-specialist01.jsonl'],
      [{ ...session(root, 'coordinator')[0] }, usage(root, 3, tokens, 'specialist')]),
    transcript([unrelated + '.jsonl'], [...session(unrelated, 'unrelated-model'), usage(unrelated, 4)]),
  ]);
  const capture = (options = {}) => exec(process.execPath, [cli,
    ...Object.entries({
      session: root, since: time(1), until: time(10), prompt: turn, 'transcript-dir': transcriptDir, store,
      'run-id': 'test-run', category: 'workflow-tooling', label: 'Test workflow', scope: 'full', ...options,
    }).flatMap(([key, value]) => value === undefined ? [] : ['--' + key, value]),
  ], { cwd: directory });
  const read = (...parts) => readFile(join(store, ...parts), 'utf8');
  return { directory, transcriptDir, store, rootRollout, capture, read, json: async (...parts) => JSON.parse(await read(...parts)) };
}

test('one command writes a deduplicated report, history and bounded analyst brief', async t => {
  const fixtureData = await fixture(t);
  const { stdout, stderr } = await fixtureData.capture();
  assert.equal(stderr, '');
  assert.deepEqual(stdout.trim().split(/\r?\n/), [
    'Run test-run | Coverage observed (full, snapshot)',
    'Responses 2 | Total tokens 280',
    'Cached input 150 | Uncached input 50 | Output 80',
    'Flags baseline-insufficient',
  ]);
  const report = await fixtureData.json('reports', 'test-run.json');
  const markdown = await fixtureData.read('reports', 'test-run.md');
  const brief = await fixtureData.json('briefs', 'test-run.json');
  const ledger = await fixtureData.json('usage-history.json');
  assert.deepEqual(report.by_thread.map(group => [group.thread_id, group.parent_thread_id]), [[root, null], [child, root]]);
  assert.equal(report.coverage.duplicate_response_records, 1);
  assert.equal(report.response_count, 2);
  assert.equal(ledger.runs.length, 1);
  assert.equal(ledger.runs[0].state, 'snapshot');
  assert.equal(brief.selection_type, 'root_turn');
  assert.equal(brief.root_input_tokens, 100);
  assert.equal(brief.prior_comparable_category_records, 0);
  assert.deepEqual(brief.window, report.window);
  assert.deepEqual(brief.totals, report.totals);
  assert.deepEqual(brief.coverage, report.coverage);
  assert.deepEqual(brief.by_model.map(({ model, effort, response_count }) => [model, effort, response_count]),
    [['coordinator', 'medium', 1], ['specialist', 'medium', 1]]);
  assert.deepEqual(brief.flags.map(flag => flag.id), ['baseline-insufficient']);
  assert.doesNotMatch(stdout + JSON.stringify(report) + markdown + JSON.stringify(brief),
    /SYNTHETIC_PRIVATE_VALUE|unrelated-model|private_response_|C:\/private/);
  assert.doesNotMatch(JSON.stringify(brief), new RegExp([root, child, turn, 'Test workflow'].join('|')));
  assert.match(await fixtureData.read('USAGE_HISTORY.md'), /Test workflow/);
  assert.match(await fixtureData.read('OPTIMIZATION_FLAGS.md'), /baseline-insufficient/);
});

test('refreshes the stable ID, includes later usage and counts only comparable category records', async t => {
  const fixtureData = await fixture(t);
  await fixtureData.capture({ state: 'closed' });
  await fixtureData.rootRollout(usage(root, 2), usage(root, 12), usage(root, 23), usage(root, 35));
  await fixtureData.capture({ 'run-id': 'other-category', category: 'other', since: time(11), until: time(20), state: 'closed' });
  await fixtureData.capture({ 'run-id': 'time-window', since: time(21), until: time(30), state: 'closed', prompt: undefined });
  await fixtureData.capture({ 'run-id': 'active-run', since: time(32), until: time(34) });
  await fixtureData.capture({ 'run-id': 'active-run', since: time(32), until: time(40), state: 'closed' });
  const ledger = await fixtureData.json('usage-history.json');
  assert.equal(ledger.runs.length, 4);
  const active = ledger.runs.find(run => run.runId === 'active-run');
  assert.equal(active.response_count, 1);
  assert.equal(active.window.end, time(40));
  assert.equal(active.state, 'closed');
  const brief = await fixtureData.json('briefs', 'active-run.json');
  assert.equal(brief.prior_comparable_category_records, 1);
  assert.equal(brief.response_count, 1);
  await assert.rejects(fixtureData.capture({ 'run-id': 'active-run', since: time(32), until: time(40) }), {
    stderr: /closed run cannot be reopened/i,
  });
  assert.deepEqual(await fixtureData.json('briefs', 'active-run.json'), brief);
});

test('rejects invalid paths, mismatched identity and overlap without replacing existing files', async t => {
  const fixtureData = await fixture(t);
  await fixtureData.capture();
  const maintained = [
    ['usage-history.json'], ['USAGE_HISTORY.md'], ['OPTIMIZATION_FLAGS.md'],
    ['reports', 'test-run.json'], ['reports', 'test-run.md'], ['briefs', 'test-run.json'],
  ];
  const originals = await Promise.all(maintained.map(parts => fixtureData.read(...parts)));
  for (const invalidID of ['../test-run', 'con', 'test-run\n']) {
    await assert.rejects(fixtureData.capture({ 'run-id': invalidID }), { stderr: /Use a run ID/ });
  }
  await assert.rejects(fixtureData.capture({ store: join(fixtureData.store, 'usage-history.json') }), {
    stderr: /capture output path is occupied/i,
  });
  await assert.rejects(fixtureData.capture({ label: 'Other identity' }), { stderr: /different workflow identity/ });
  await assert.rejects(fixtureData.capture({ 'run-id': 'overlap' }), { stderr: /overlaps another run/ });
  await mkdir(join(fixtureData.store, 'reports', 'blocked.json'));
  await assert.rejects(fixtureData.capture({ 'run-id': 'blocked', since: time(11), until: time(20) }), {
    stderr: /capture output path is occupied/i,
  });
  assert.deepEqual(await Promise.all(maintained.map(parts => fixtureData.read(...parts))), originals);
  await assert.rejects(fixtureData.read('briefs', 'overlap.json'), { code: 'ENOENT' });
});

test('keeps missing telemetry unavailable and leaves prior runs intact', async t => {
  const fixtureData = await fixture(t);
  await fixtureData.capture();
  const prior = (await fixtureData.json('usage-history.json')).runs[0];
  const { stdout } = await fixtureData.capture({
    'run-id': 'missing', since: time(11), until: time(20), 'transcript-dir': join(fixtureData.directory, 'missing'),
  });
  assert.match(stdout, /Coverage unavailable/);
  assert.match(stdout, /Total tokens unavailable/);
  assert.match(stdout, /Flags telemetry-coverage, baseline-insufficient/);
  const brief = await fixtureData.json('briefs', 'missing.json');
  assert.equal(brief.coverage.transcript_directory_found, false);
  assert.equal(brief.response_count, 0);
  assert.ok(Object.values(brief.totals).every(value => value === null));
  const maintained = (await fixtureData.json('usage-history.json')).runs.find(run => run.runId === 'test-run');
  assert.deepEqual(maintained, prior);
});

test('honors an existing capture lock and preserves the ledger if its Markdown views fail', async t => {
  const fixtureData = await fixture(t);
  await mkdir(fixtureData.store);
  const lock = join(fixtureData.store, '.usage-capture.lock');
  await writeFile(lock, 'other writer');
  await assert.rejects(fixtureData.capture(), { stderr: /capture store is locked/ });
  assert.equal(await fixtureData.read('.usage-capture.lock'), 'other writer');
  await assert.rejects(fixtureData.read('usage-history.json'), { code: 'ENOENT' });

  await rm(lock);
  const blockedView = join(fixtureData.store, 'USAGE_HISTORY.md');
  await mkdir(blockedView);
  await assert.rejects(fixtureData.capture(), { stderr: /usage ledger was saved/i });
  assert.equal((await fixtureData.json('usage-history.json')).runs.length, 1);
  await assert.rejects(fixtureData.read('briefs', 'test-run.json'), { code: 'ENOENT' });
  await rm(blockedView, { recursive: true });
  await fixtureData.capture();
  assert.equal((await fixtureData.json('usage-history.json')).runs.length, 1);
  assert.equal((await fixtureData.json('briefs', 'test-run.json')).response_count, 2);
});
