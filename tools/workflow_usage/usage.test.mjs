import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { collectUsage, renderMarkdown } from './usage.mjs';

const cliFile = fileURLToPath(new URL('./usage.mjs', import.meta.url));
const run = promisify(execFile);
const id = number => '00000000-0000-7000-a000-' + String(number).padStart(12, '0');
const at = second => '2026-11-19T15:00:' + String(second).padStart(2, '0') + '.000Z';
const root = id(1);
const child = id(2);
const leaf = id(3);
const unrelated = id(4);
const turn = id(5);
const childTurn = id(6);
const otherTurn = id(7);
const secret = 'SYNTHETIC_PRIVATE_TRANSCRIPT_ZQ';
const normal = {
  input_tokens: 100, cached_input_tokens: 75, cache_write_input_tokens: 12,
  output_tokens: 40, reasoning_output_tokens: 30, total_tokens: 140,
};

const entry = (type, payload, second) => ({ timestamp: at(second), type, payload });
const header = (thread, options = {}) => entry('session_meta', {
  id: thread, cwd: 'C:/private/' + secret, base_instructions: secret, ...options,
}, 0);
const context = (model, second, turnId = turn, rootTurn = turn, effort = 'medium') =>
  entry('turn_context', { turn_id: turnId, root_turn_id: rootTurn, model, effort, summary: secret }, second);
const usage = (thread, response, second, counts = normal, turnId = turn, rootTurn = turn) =>
  entry('token_usage_record', {
    thread_id: thread, response_id: response, turn_id: turnId, root_turn_id: rootTurn, usage: counts,
    turn_token_usage: { total_tokens: 1000000 }, thread_token_usage: { total_tokens: 1000000, notes: secret },
  }, second);
const cumulative = second => entry('event_msg', { type: 'token_count', info: { total_token_usage: { total_tokens: 999999 } } }, second);

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'workflow-usage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sessions = join(directory, 'sessions');
  await mkdir(join(sessions, '2026', '11', '19'), { recursive: true });
  return {
    directory, sessions,
    file: (name, ...lines) => writeFile(join(sessions, '2026', '11', '19', 'rollout-' + name + '.jsonl'),
      lines.map(line => typeof line === 'string' ? line : JSON.stringify(line)).join('\n')),
    report: (options = {}) => collectUsage({ rolloutDir: sessions, rootThreadId: root, since: at(1), until: at(30), ...options }),
  };
}

test('reports deduplicated root, child and grandchild usage without unrelated payloads or cumulative counters', async t => {
  const log = await fixture(t);
  await Promise.all([
    log.file('root', header(root), context('gpt-6.2-sol', 1), usage(root, 'resp_same', 2), cumulative(3),
      usage(root, 'resp_same', 4), entry('response_item', { content: secret }, 5)),
    log.file('child', header(child, { source: { subagent: { thread_spawn: { parent_thread_id: root, agent_path: secret } } } }),
      context('gpt-6.2-astra', 1, childTurn, turn, 'high'), usage(child, 'resp_same', 2, normal, childTurn), cumulative(3)),
    log.file('leaf', header(leaf, { parent_thread_id: child }),
      context('gpt-6.2-sol', 1), usage(leaf, 'resp_leaf', 2)),
    log.file('unrelated', header(unrelated), context(secret, 1), usage(unrelated, 'resp_other', 2), '{"broken_private":'),
  ]);
  const report = await log.report({ turnId: turn });
  assert.equal(report.coverage.status, 'observed');
  assert.equal(report.coverage.malformed_json_lines, 0);
  assert.equal(report.coverage.duplicate_response_records, 1);
  assert.equal(report.response_count, 3);
  assert.deepEqual(report.totals, {
    input_tokens: 300, cached_input_tokens: 225, cache_write_input_tokens: 36,
    output_tokens: 120, reasoning_output_tokens: 90, total_tokens: 420, uncached_input_tokens: 75,
  });
  assert.deepEqual(report.by_thread.map(row => [row.thread_id, row.parent_thread_id, row.response_count]),
    [[root, null, 1], [child, root, 1], [leaf, child, 1]]);
  assert.deepEqual(report.by_model.map(row => [row.model, row.effort, row.response_count]),
    [['gpt-6.2-astra', 'high', 1], ['gpt-6.2-sol', 'medium', 2]]);
  assert.doesNotMatch(JSON.stringify(report) + renderMarkdown(report), new RegExp(secret + '|999999|1000000|resp_same|C:/private'));
});

test('bounds a workflow by timestamps and root turn, attributing only matching prior model context', async t => {
  const log = await fixture(t);
  await log.file('root', header(root), context('before', 0), usage(root, 'before', 0), usage(root, 'before', 2),
    usage(root, 'head', 1), context('new-model', 5, turn, turn, 'high'), usage(root, 'in', 5),
    context('other-model', 6, otherTurn, otherTurn), usage(root, 'other', 7, normal, otherTurn, otherTurn),
    usage(root, 'unknown', 8), usage(root, 'end', 30));
  const report = await log.report({ turnId: turn });
  assert.deepEqual(report.window, { start: at(1), end: at(30) });
  assert.equal(report.root_turn_id, turn);
  assert.equal(report.response_count, 3);
  assert.deepEqual(report.by_model.map(row => [row.model, row.effort, row.response_count]),
    [['before', 'medium', 1], ['new-model', 'high', 1], [null, null, 1]]);
  assert.equal(report.coverage.unknown_model_responses, 1);
  assert.equal((await log.report()).response_count, 4);
});

test('marks partial telemetry and missing fields while preserving observed zeroes', async t => {
  const log = await fixture(t);
  await log.file('root', header(root), context('valid', 1), usage(root, 'full', 2),
    usage(root, 'partial', 3, { input_tokens: 5, cached_input_tokens: 0, output_tokens: 0, total_tokens: 5 }),
    usage(root, 'invalid', 4, { input_tokens: 7, cached_input_tokens: 10, cache_write_input_tokens: 0,
      output_tokens: 4, reasoning_output_tokens: -1, total_tokens: 200 }),
    usage(root, 'excluded', 5, normal, turn, null), '{"truncated":');
  const report = await log.report({ turnId: turn });
  assert.equal(report.response_count, 3);
  assert.deepEqual(report.totals, {
    input_tokens: 112, cached_input_tokens: null, cache_write_input_tokens: null,
    output_tokens: 44, reasoning_output_tokens: null, total_tokens: null, uncached_input_tokens: null,
  });
  assert.equal(report.coverage.status, 'partial');
  assert.equal(report.coverage.malformed_json_lines, 1);
  assert.equal(report.coverage.records_missing_root_turn, 1);
  assert.equal(report.coverage.missing_fields.reasoning_output_tokens, 2);
  assert.equal(report.coverage.missing_fields.cached_input_tokens, 1);
  assert.match(renderMarkdown(report), /Unavailable/);
  const zeroes = await log.report({ since: at(3), until: at(4) });
  assert.equal(zeroes.totals.output_tokens, 0);
  assert.equal(zeroes.totals.cached_input_tokens, 0);
});

test('distinguishes unavailable telemetry, unsupported legacy data, and missing root metadata', async t => {
  const log = await fixture(t);
  await log.file('root', header(root), context('gpt-6.2-sol', 1), cumulative(2));
  const legacy = await log.report();
  assert.equal(legacy.coverage.status, 'unavailable');
  assert.equal(legacy.coverage.root_thread_found, true);
  assert.equal(legacy.coverage.legacy_only_threads, 1);
  assert.equal(legacy.response_count, 0);
  assert.ok(Object.values(legacy.totals).every(value => value === null));
  assert.match(renderMarkdown(legacy), /unsupported cumulative/);
  const missing = await log.report({ rootThreadId: unrelated });
  assert.equal(missing.coverage.root_thread_found, false);
  assert.equal(missing.coverage.status, 'unavailable');
  assert.deepEqual(missing.by_thread, []);
  const absent = await log.report({ rolloutDir: join(log.directory, 'none') });
  assert.equal(absent.coverage.rollout_directory_found, false);
  assert.equal(absent.coverage.status, 'unavailable');
});

test('deduplicates copied rollouts and drops conflicting response IDs from totals', async t => {
  const log = await fixture(t);
  await Promise.all([
    log.file('a-root', header(root), context('gpt-6.2-sol', 1), usage(root, 'repeat', 2), usage(root, 'conflict', 3)),
    log.file('z-root', header(root), context('gpt-6.2-sol', 1), usage(root, 'repeat', 4),
      usage(root, 'conflict', 5, { ...normal, output_tokens: 50, total_tokens: 150 }),
      usage(unrelated, 'wrong-thread-record', 6)),
  ]);
  const report = await log.report();
  assert.equal(report.response_count, 1);
  assert.equal(report.totals.total_tokens, 140);
  assert.equal(report.coverage.duplicate_response_records, 2);
  assert.equal(report.coverage.conflicting_response_ids, 1);
  assert.equal(report.coverage.invalid_response_records, 1);
  assert.equal(report.coverage.status, 'partial');
});

test('keeps traversal inside the rollout root even if a linked directory has a matching child header', async t => {
  const log = await fixture(t);
  const outside = join(log.directory, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'rollout-linked.jsonl'),
    [header(child, { parent_thread_id: root }), context('gpt-6.2-astra', 1), usage(child, 'linked', 2)].map(JSON.stringify).join('\n'));
  try {
    await symlink(outside, join(log.sessions, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    t.skip('The host does not allow directory links.');
    return;
  }
  await log.file('root', header(root), context('gpt-6.2-sol', 1), usage(root, 'root', 2));
  const report = await log.report();
  assert.deepEqual(report.by_thread.map(row => row.thread_id), [root]);
  assert.equal(report.response_count, 1);
});

test('validates explicit scope, writes sanitized CLI reports, and avoids printing raw invalid arguments', async t => {
  const log = await fixture(t);
  await assert.rejects(log.report({ rootThreadId: secret }), /root thread UUID/);
  await assert.rejects(log.report({ turnId: secret }), /turn filter.*UUID/);
  await assert.rejects(log.report({ since: undefined }), /ISO 8601/);
  await assert.rejects(log.report({ since: '2026-11-31T01:00:00Z' }), /ISO 8601/);
  await assert.rejects(log.report({ until: at(1) }), /ISO 8601/);
  await log.file('root', header(root), context('unsafe|name\\' + secret, 1), usage(root, 'resp_root', 2),
    entry('response_item', { content: secret }, 3));

  const json = join(log.directory, 'report', 'usage.json');
  const md = join(log.directory, 'report', 'usage.md');
  const cli = (...args) => run(process.execPath, [cliFile, ...args]);
  const { stdout, stderr } = await cli('--thread', root, '--since', at(1), '--until', at(30), '--rollout-dir',
    log.sessions, '--output', json, '--markdown', md);
  const files = await Promise.all([readFile(json, 'utf8'), readFile(md, 'utf8')]);
  assert.equal(stderr, '');
  assert.match(stdout, /partial · 1 responses · 140 total tokens/);
  assert.ok(files.every(content => !content.includes(secret) && !content.includes(log.directory)));
  assert.equal(JSON.parse(files[0]).schema_version, 1);
  assert.match(files[1], /\| Unknown \| medium \| 1 \|/);
  await assert.rejects(cli('--unknown-' + secret), error => {
    assert.equal(error.code, 1);
    assert.doesNotMatch(error.stderr, new RegExp(secret));
    return true;
  });
});
