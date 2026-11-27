import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { collectUsage, defaultTranscriptDir, renderMarkdown, subagentThreadId } from './usage.mjs';

const cliFile = fileURLToPath(new URL('./usage.mjs', import.meta.url));
const run = promisify(execFile);
const id = number => '00000000-0000-7000-a000-' + String(number).padStart(12, '0');
const at = second => '2026-11-19T15:00:' + String(second).padStart(2, '0') + '.000Z';
const root = id(1);
const unrelated = id(4);
const prompt = id(5);
const otherPrompt = id(7);
const secret = 'SYNTHETIC_PRIVATE_TRANSCRIPT_ZQ';
// Anthropic usage: input_tokens excludes cache reads and writes.
const normal = {
  input_tokens: 13, cache_creation_input_tokens: 12, cache_read_input_tokens: 75,
  output_tokens: 40, output_tokens_details: { thinking_tokens: 30 },
};
const normalized = {
  input_tokens: 100, cached_input_tokens: 75, cache_write_input_tokens: 12,
  output_tokens: 40, reasoning_output_tokens: 30, total_tokens: 140, uncached_input_tokens: 25,
};

const user = (session, second, promptId = prompt) => ({
  type: 'user', timestamp: at(second), sessionId: session, promptId, cwd: 'C:/private/' + secret,
  message: { role: 'user', content: secret },
});
const assistant = (session, request, second, usage = normal, { model = 'claude-sonnet-5-5', effort = 'medium', agentId } = {}) => ({
  type: 'assistant', timestamp: at(second), sessionId: session, requestId: request, effort,
  ...(agentId ? { agentId, isSidechain: true } : {}),
  message: { id: 'msg_' + request, role: 'assistant', model, content: [{ type: 'text', text: secret }], usage },
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'workflow-usage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const projects = join(directory, 'projects');
  const project = join(projects, 'c--private-project');
  await mkdir(project, { recursive: true });
  const write = async (path, lines) => {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, lines.map(line => typeof line === 'string' ? line : JSON.stringify(line)).join('\n'));
  };
  return {
    directory, projects, project,
    session: (session, ...lines) => write(join(project, session + '.jsonl'), lines),
    subagent: (session, agent, ...lines) => write(join(project, session, 'subagents', 'agent-' + agent + '.jsonl'), lines),
    write,
    report: (options = {}) => collectUsage({ transcriptDir: projects, rootThreadId: root, since: at(1), until: at(30), ...options }),
  };
}

test('defaults to the Claude Code projects directory and honors CLAUDE_CONFIG_DIR', () => {
  assert.match(defaultTranscriptDir({}), /[\\/]\.claude[\\/]projects$/);
  assert.equal(defaultTranscriptDir({ CLAUDE_CONFIG_DIR: join('x', 'cfg') }), join('x', 'cfg', 'projects'));
});

test('reports deduplicated session and subagent usage without unrelated payloads', async t => {
  const log = await fixture(t);
  const agent = subagentThreadId(root, 'a1b2c3');
  await Promise.all([
    // One API response is written as one line per content block with identical usage.
    log.session(root, user(root, 1), assistant(root, 'req_same', 2), assistant(root, 'req_same', 2),
      assistant(root, 'req_two', 4, normal, { model: 'claude-opus-5-5', effort: 'high' })),
    log.subagent(root, 'a1b2c3', user(root, 1), assistant(root, 'req_agent', 3, normal, { agentId: 'a1b2c3' })),
    log.session(unrelated, user(unrelated, 1), assistant(unrelated, 'req_other', 2), '{"broken_private":'),
  ]);
  const report = await log.report({ turnId: prompt });
  assert.equal(report.coverage.source, 'claude_code_transcript_usage');
  assert.equal(report.coverage.status, 'observed');
  assert.equal(report.coverage.malformed_json_lines, 0);
  assert.equal(report.coverage.duplicate_response_records, 1);
  assert.equal(report.response_count, 3);
  assert.deepEqual(report.totals, Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, value * 3])));
  assert.deepEqual(report.by_thread.map(row => [row.thread_id, row.parent_thread_id, row.response_count]),
    [[root, null, 2], [agent, root, 1]]);
  assert.deepEqual(report.by_model.map(row => [row.model, row.effort, row.response_count]),
    [['claude-opus-5-5', 'high', 1], ['claude-sonnet-5-5', 'medium', 2]]);
  assert.doesNotMatch(JSON.stringify(report) + renderMarkdown(report),
    new RegExp(secret + '|req_same|msg_|a1b2c3|C:/private|c--private-project'));
});

test('bounds a workflow by timestamps and root prompt', async t => {
  const log = await fixture(t);
  await log.session(root, user(root, 0), assistant(root, 'before', 0), assistant(root, 'head', 1),
    assistant(root, 'in', 5, normal, { model: 'claude-opus-5-5', effort: 'high' }),
    user(root, 6, otherPrompt), assistant(root, 'other', 7), assistant(root, 'end', 30));
  const report = await log.report({ turnId: prompt });
  assert.deepEqual(report.window, { start: at(1), end: at(30) });
  assert.equal(report.root_turn_id, prompt);
  assert.equal(report.response_count, 2);
  assert.deepEqual(report.by_model.map(row => [row.model, row.effort, row.response_count]),
    [['claude-opus-5-5', 'high', 1], ['claude-sonnet-5-5', 'medium', 1]]);
  assert.equal((await log.report()).response_count, 3);
  await assert.rejects(log.report({ turnId: 'not-a-uuid' }), /prompt filter.*UUID/);
});

test('marks partial telemetry and missing fields while preserving observed zeroes', async t => {
  const log = await fixture(t);
  await log.session(root, user(root, 1), assistant(root, 'full', 2),
    assistant(root, 'partial', 3, { input_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 }),
    assistant(root, 'invalid', 4, { input_tokens: 7, cache_read_input_tokens: 3, output_tokens: 4,
      output_tokens_details: { thinking_tokens: 9 } }),
    assistant(root, 'synthetic', 5, { input_tokens: 0, output_tokens: 0 }, { model: '<synthetic>' }),
    '{"truncated":');
  const report = await log.report();
  assert.equal(report.response_count, 3);
  assert.deepEqual(report.totals, {
    input_tokens: null, cached_input_tokens: null, cache_write_input_tokens: null,
    output_tokens: 44, reasoning_output_tokens: null, total_tokens: null, uncached_input_tokens: null,
  });
  assert.equal(report.coverage.status, 'partial');
  assert.equal(report.coverage.malformed_json_lines, 1);
  assert.equal(report.coverage.synthetic_records_skipped, 1);
  assert.equal(report.coverage.missing_fields.reasoning_output_tokens, 2);
  assert.equal(report.coverage.missing_fields.input_tokens, 1);
  assert.match(renderMarkdown(report), /Unavailable/);
  const zeroes = await log.report({ since: at(3), until: at(4) });
  assert.equal(zeroes.totals.output_tokens, 0);
  assert.equal(zeroes.totals.cached_input_tokens, 0);
});

test('distinguishes unavailable telemetry and missing root transcripts', async t => {
  const log = await fixture(t);
  await log.session(root, user(root, 1), user(root, 2));
  const empty = await log.report();
  assert.equal(empty.coverage.status, 'unavailable');
  assert.equal(empty.coverage.root_thread_found, true);
  assert.equal(empty.response_count, 0);
  assert.ok(Object.values(empty.totals).every(value => value === null));
  const missing = await log.report({ rootThreadId: unrelated });
  assert.equal(missing.coverage.root_thread_found, false);
  assert.equal(missing.coverage.status, 'unavailable');
  assert.deepEqual(missing.by_thread, []);
  const absent = await log.report({ transcriptDir: join(log.directory, 'none') });
  assert.equal(absent.coverage.transcript_directory_found, false);
  assert.equal(absent.coverage.status, 'unavailable');
  assert.match(renderMarkdown(absent), /transcript directory was unavailable/);
});

test('deduplicates copied transcripts and drops conflicting or foreign records from totals', async t => {
  const log = await fixture(t);
  await Promise.all([
    log.session(root, user(root, 1), assistant(root, 'repeat', 2), assistant(root, 'conflict', 3)),
    log.write(join(log.projects, 'copied-project', root + '.jsonl'), [user(root, 1), assistant(root, 'repeat', 4),
      assistant(root, 'conflict', 5, { ...normal, output_tokens: 50 }), assistant(unrelated, 'wrong-session', 6)]),
  ]);
  const report = await log.report();
  assert.equal(report.response_count, 1);
  assert.equal(report.totals.total_tokens, 140);
  assert.equal(report.coverage.duplicate_response_records, 2);
  assert.equal(report.coverage.conflicting_response_ids, 1);
  assert.equal(report.coverage.invalid_response_records, 1);
  assert.equal(report.coverage.status, 'partial');
});

test('keeps traversal inside the transcript root even if a linked directory has matching subagents', async t => {
  const log = await fixture(t);
  const outside = join(log.directory, 'outside');
  await log.write(join(outside, root, 'subagents', 'agent-linked.jsonl'), [assistant(root, 'linked', 2, normal, { agentId: 'linked' })]);
  try {
    await symlink(outside, join(log.projects, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    t.skip('The host does not allow directory links.');
    return;
  }
  await log.session(root, user(root, 1), assistant(root, 'root', 2));
  const report = await log.report();
  assert.deepEqual(report.by_thread.map(row => row.thread_id), [root]);
  assert.equal(report.response_count, 1);
});

test('validates explicit scope, writes sanitized CLI reports, and avoids printing raw invalid arguments', async t => {
  const log = await fixture(t);
  await assert.rejects(log.report({ rootThreadId: secret }), /root session UUID/);
  await assert.rejects(log.report({ since: undefined }), /ISO 8601/);
  await assert.rejects(log.report({ since: '2026-11-31T01:00:00Z' }), /ISO 8601/);
  await assert.rejects(log.report({ until: at(1) }), /ISO 8601/);
  await log.session(root, user(root, 1), assistant(root, 'req_root', 2, normal, { model: 'unsafe|name\\' + secret }));

  const json = join(log.directory, 'report', 'usage.json');
  const md = join(log.directory, 'report', 'usage.md');
  const cli = (...args) => run(process.execPath, [cliFile, ...args]);
  const { stdout, stderr } = await cli('--session', root, '--since', at(1), '--until', at(30), '--transcript-dir',
    log.projects, '--output', json, '--markdown', md);
  const files = await Promise.all([readFile(json, 'utf8'), readFile(md, 'utf8')]);
  assert.equal(stderr, '');
  assert.match(stdout, /partial · 1 responses · 140 total tokens/);
  assert.ok(files.every(content => !content.includes(secret) && !content.includes(log.directory)));
  assert.equal(JSON.parse(files[0]).schema_version, 1);
  assert.match(files[1], /# Claude Code workflow token usage/);
  assert.match(files[1], /\| Unknown \| medium \| 1 \|/);
  await assert.rejects(cli('--unknown-' + secret), error => {
    assert.equal(error.code, 1);
    assert.doesNotMatch(error.stderr, new RegExp(secret));
    return true;
  });
});
