import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildInvocation } from './packet.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('./packet.mjs', import.meta.url));
const task = {
  task_id: '#58',
  workflow_id: 'rfs58-packet-checks',
  tier: 'QUICK',
  role_ref: 'RFS-AUTO',
  outcome: 'Verify generator output.',
  acceptance_criteria: ['Use fresh context.'],
  relevant_paths: ['tools/agent_workflow/packet.mjs'],
  approval_limits: ['Use read-only local checks.'],
};

const engineer = buildInvocation(task).spawn;
const toReview = {
  ...task,
  role_ref: 'RFS-AUTO-REVIEW',
  implementation_handoff: {
    role_ref: task.role_ref,
    agent_id: engineer.task_name,
    summary: 'The focused Node checks passed. Live invocation remains unverified.',
  },
};
const reviewer = buildInvocation(toReview).spawn;

test('all seven registered pairs get distinct fresh identities and their selected model routes', () => {
  const pairs = [
    ['FE', 'rfs_frontend_engineer', 'rfs_frontend_reviewer', 'gpt-6.2-sol', 'gpt-6.1-sol'],
    ['BE', 'rfs_backend_engineer', 'rfs_backend_reviewer', 'gpt-6.2-sol', 'gpt-6.1-sol'],
    ['UX', 'rfs_ui_ux_designer', 'rfs_ui_ux_design_reviewer', 'gpt-6.2-astra', 'gpt-6.1-terra'],
    ['SEC', 'rfs_security_engineer', 'rfs_security_reviewer', 'gpt-6.2-astra', 'gpt-6.2-astra'],
    ['DB', 'rfs_database_engineer', 'rfs_database_reviewer', 'gpt-6.2-sol', 'gpt-6.1-sol'],
    ['BOT', 'rfs_ai_chatbot_engineer', 'rfs_ai_chatbot_reviewer', 'gpt-6.2-sol', 'gpt-6.1-sol'],
    ['AUTO', 'rfs_automation_engineer', 'rfs_automation_reviewer', 'gpt-6.2-sol', 'gpt-6.1-sol'],
  ];
  const identities = new Set();
  for (const [id, engineerProfile, reviewerProfile, engineerModel, reviewerModel] of pairs) {
    const input = { ...task, role_ref: `RFS-${id}` };
    const implementation = buildInvocation(input);
    const review = buildInvocation({
      ...input,
      role_ref: `RFS-${id}-REVIEW`,
      implementation_handoff: {
        role_ref: input.role_ref, agent_id: implementation.spawn.task_name, summary: 'Local check passed.',
      },
    });
    assert.equal(implementation.profile, engineerProfile);
    assert.equal(review.profile, reviewerProfile);
    assert.equal(implementation.spawn.model, engineerModel);
    assert.equal(implementation.spawn.reasoning_effort, engineerModel === 'gpt-6.2-astra' ? 'high' : 'medium');
    assert.equal(review.spawn.model, reviewerModel);
    assert.equal(review.spawn.reasoning_effort, 'high');
    assert.equal(implementation.spawn.fork_turns, 'none');
    assert.equal(review.spawn.fork_turns, 'none');
    assert.match(review.spawn.message, /Implementation handoff from .*Local check passed/);
    identities.add(implementation.spawn.task_name);
    identities.add(review.spawn.task_name);
  }
  assert.equal(identities.size, 14);
});

test('output is deterministic, includes only path references, and supports a fresh retry', () => {
  const input = {
    ...task,
    source_revision: 'abcdef1',
    checks: ['Run the Node test suite.'],
    relevant_paths: ['frontend/src/app/api/auth/login/route.js'],
  };
  assert.deepEqual(buildInvocation(input), buildInvocation(input));
  const first = buildInvocation(input).spawn;
  assert.ok(first.message.includes('frontend/src/app/api/auth/login/route.js'));
  assert.ok(!first.message.includes(readFileSync(join(root, input.relevant_paths[0]), 'utf8')));
  assert.match(first.message, /Source revision: abcdef1/);
  assert.match(first.message, /Run the Node test suite/);
  assert.match(first.message, /Use read-only local checks/);
  const retry = buildInvocation({ ...input, attempt: 2 }).spawn;
  assert.notEqual(first.task_name, retry.task_name);
  assert.notEqual(reviewer.task_name, buildInvocation({ ...toReview, attempt: 2 }).spawn.task_name);
});

test('review instructions increase by tier', () => {
  assert.match(reviewer.message, /check the changed behavior/);
  assert.match(buildInvocation({ ...toReview, tier: 'STANDARD' }).spawn.message, /relevant regression/);
  assert.match(buildInvocation({ ...toReview, tier: 'FULL' }).spawn.message, /additional risk review/);
});

test('backlog preserves evidence, labels, and PM acceptance after the correct review handoff', () => {
  const input = {
    ...task,
    role_ref: 'RFS-BACKLOG',
    review_handoff: {
      role_ref: toReview.role_ref,
      agent_id: reviewer.task_name,
      summary: 'Independent checks passed. PM acceptance pending.',
    },
  };
  const { profile, spawn } = buildInvocation(input);
  assert.equal(profile, 'rfs_backlog_handoff');
  assert.equal(spawn.model, 'gpt-6.1-sol');
  assert.equal(spawn.reasoning_effort, 'low');
  assert.equal(spawn.fork_turns, 'none');
  assert.match(spawn.message, /tracker before authorized Trello actions/);
  assert.match(spawn.message, /Preserve labels and outstanding PM acceptance/);
  assert.match(spawn.message, /PM acceptance pending/);
  assert.throws(() => buildInvocation({ ...input, review_handoff: undefined }), /registered reviewer/);
  assert.throws(() => buildInvocation({
    ...input, review_handoff: { ...input.review_handoff, agent_id: `/root/${spawn.task_name}` },
  }), /independent specialist identity/);
});

test('review handoff accepts a completed client identity and rejects a missing or next actor ID', () => {
  const actual = '/root/reviewer_context_implementation';
  const buildWithIdentity = (agent_id) => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, agent_id },
  });
  assert.match(buildWithIdentity(actual).spawn.message, /handoff from \/root\/reviewer_context_implementation:/);
  for (const identity of [reviewer.task_name, `/root/${reviewer.task_name}`]) {
    assert.throws(() => buildWithIdentity(identity), /independent specialist identity/);
  }
  for (const identity of [undefined, '', '/root/../up', 'with spaces', 'a'.repeat(181)]) {
    assert.throws(() => buildWithIdentity(identity), /expected completed specialist/);
  }
});

test('rejects required field omissions, unexpected fields, and invalid routing', () => {
  for (const field of Object.keys(task)) {
    const incomplete = { ...task };
    delete incomplete[field];
    assert.throws(() => buildInvocation(incomplete), Error, field);
  }
  assert.throws(() => buildInvocation({ ...task, tier: 'quick' }), /Tier must be/);
  assert.throws(() => buildInvocation({ ...task, role_ref: 'rfs_reviewer' }), /registered engineer/);
  assert.throws(() => buildInvocation({ ...task, role_ref: ['RFS-AUTO'] }), /registered engineer/);
  assert.throws(() => buildInvocation({ ...task, attempt: 4 }), /Attempt/);
  assert.throws(() => buildInvocation({ ...task, workflow_id: 'two words' }), /workflow_id/);
  assert.throws(() => buildInvocation({ ...task, logs: 'unexpected data' }), /Invalid task packet/);
  assert.throws(() => buildInvocation({ ...toReview, implementation_handoff: undefined }), /handoff fields/);
  assert.throws(() => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, agent_id: reviewer.task_name },
  }), /independent specialist identity/);
  assert.throws(() => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, role_ref: 'RFS-FE' },
  }), /expected completed specialist/);
  assert.throws(() => buildInvocation({
    ...task, implementation_handoff: toReview.implementation_handoff,
  }), /only accepted for its next stage/);
});

test('rejects traversal, sensitive paths, directories, and missing files', () => {
  const unsafePaths = [
    '../AGENTS.md', './AGENTS.md', '/AGENTS.md', 'C:/AGENTS.md', 'tools\\agent_workflow\\packet.mjs',
    'tools//agent_workflow/packet.mjs', 'docs/../AGENTS.md', '.git/config', '.workflow-usage/session.json',
    'backend/.ENV.local', '.envrc', 'cert.pem', 'backend/credentials.json', 'private-copy.txt',
    'auth.json', 'worker.log', 'session.jsonl',
  ];
  for (const path of unsafePaths) {
    assert.throws(() => buildInvocation({ ...task, relevant_paths: [path] }), /non-sensitive/, path);
  }
  for (const path of ['tools', 'tools/agent_workflow/absent.txt']) {
    assert.throws(() => buildInvocation({ ...task, relevant_paths: [path] }), /missing, linked/, path);
  }
});

test('rejects symlink aliases, including an in-repository target', (context) => {
  const scratch = mkdtempSync(join(tmpdir(), 'rfs-packet-'));
  context.after(() => rmSync(scratch, { recursive: true, force: true }));
  const files = [
    '.agents/team.json', '.agents/model-routing.json', '.codex/agents/rfs-automation-engineer.toml',
    '.agents/skills/automation-implementation/SKILL.md',
  ];
  for (const path of files) {
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    copyFileSync(join(root, path), join(scratch, path));
  }
  writeFileSync(join(scratch, 'inside.txt'), 'Local evidence.');
  symlinkSync('inside.txt', join(scratch, 'alias.txt'));
  assert.throws(() => buildInvocation({ ...task, relevant_paths: ['alias.txt'] }, { root: scratch }), /linked/);
  assert.doesNotThrow(() => buildInvocation({ ...task, relevant_paths: ['inside.txt'] }, { root: scratch }));
});

test('rejects recognizable secrets and raw multiline or fenced material without echoing values', () => {
  for (const outcome of [
    'API_KEY=mock-sensitive-value',
    'OPENAI_API_KEY=mock-sensitive-value',
    'token=mock-sensitive-value',
    'Use ghp_fakeFAKEfakeFAKEfakeFAKE',
    'https://person:mock-sensitive-value@example.test/',
    'Raw\nlog history',
    'Use \u0060\u0060\u0060source\u0060\u0060\u0060',
  ]) {
    assert.throws(() => buildInvocation({ ...task, outcome }), /^Error: Outcome must be bounded, sanitized, single-line text\.$/);
  }
});

test('rejects URI userinfo across schemes and permits URLs without it', () => {
  const credentials = [
    'postgresql://operator:fake-password@example.test/db',
    'postgresql+psycopg://operator:p%40ss@example.test/db',
    'redis://:fake-password@example.test:6379/0',
    'rediss://fake-access-key@example.test:6379/0',
    'mongodb+srv://operator:fake-password@example.test/db',
    'FTP://operator:fake-password@example.test/',
  ];
  for (const uri of credentials) {
    assert.throws(() => buildInvocation({ ...task, outcome: `Check ${uri}` }),
      /^Error: Outcome must be bounded, sanitized, single-line text\.$/);
  }
  assert.throws(() => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, summary: credentials[0] },
  }), /^Error: Implementation handoff must be bounded, sanitized, single-line text\.$/);

  for (const uri of [
    'postgresql://example.test:5432/db',
    'redis://example.test:6379/0',
    'https://example.test/@docs?tag=x@y',
  ]) {
    assert.ok(buildInvocation({ ...task, outcome: `Check ${uri}` }).spawn.message.includes(uri));
  }
});

test('enforces the 200-word previous handoff and the 500-word total briefing boundaries', () => {
  const edge = 'ok '.repeat(200).trim();
  assert.doesNotThrow(() => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, summary: edge },
  }));
  assert.throws(() => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, summary: edge + ' extra' },
  }), /handoff exceeds 200 words/);
  const brief = buildInvocation({ ...task, checks: ['ok'] }).spawn.message;
  const remaining = 500 - brief.trim().split(/\s+/u).length;
  const checks = Array.from({ length: 3 }, () => 'ok '.repeat(100).trim());
  checks.push('ok '.repeat(remaining - 302).trim());
  const boundary = buildInvocation({ ...task, checks }).spawn.message;
  assert.equal(boundary.trim().split(/\s+/u).length, 500);
  assert.throws(() => buildInvocation({ ...task, checks: [...checks, 'extra'] }), /500-word/);
});

test('CLI emits only invocation JSON and fails safely on oversized or malformed input', () => {
  const valid = spawnSync(process.execPath, [script], { input: JSON.stringify(task), encoding: 'utf8', cwd: tmpdir() });
  assert.equal(valid.status, 0, valid.stderr);
  assert.deepEqual(JSON.parse(valid.stdout), buildInvocation(task));
  const oversized = spawnSync(process.execPath, [script], { input: ' '.repeat(12_001), encoding: 'utf8' });
  assert.equal(oversized.status, 1);
  assert.equal(oversized.stdout, '');
  assert.match(oversized.stderr, /too large/);
  const malformed = spawnSync(process.execPath, [script], { input: 'fake-sensitive-value', encoding: 'utf8' });
  assert.equal(malformed.status, 1);
  assert.equal(malformed.stdout, '');
  assert.match(malformed.stderr, /valid task packet JSON/);
  assert.doesNotMatch(malformed.stderr, /fake-sensitive-value/);
});
