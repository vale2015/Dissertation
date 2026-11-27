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

// Flatten the Claude Agent-tool call for assertions on the generated briefing.
const view = (result) => ({ ...result, message: result.agent.prompt });
const engineer = view(buildInvocation(task));
const toReview = {
  ...task,
  role_ref: 'RFS-AUTO-REVIEW',
  implementation_handoff: {
    role_ref: task.role_ref,
    agent_id: engineer.task_name,
    summary: 'The focused Node checks passed. Live invocation remains unverified.',
  },
};
const reviewer = view(buildInvocation(toReview));

test('all seven registered pairs get distinct fresh identities and their selected model routes', () => {
  const pairs = [
    ['FE', 'rfs-frontend-engineer', 'rfs-frontend-reviewer', 'claude-sonnet-5-5', 'medium'],
    ['BE', 'rfs-backend-engineer', 'rfs-backend-reviewer', 'claude-sonnet-5-5', 'medium'],
    ['UX', 'rfs-ui-ux-designer', 'rfs-ui-ux-design-reviewer', 'claude-opus-5-5', 'high'],
    ['SEC', 'rfs-security-engineer', 'rfs-security-reviewer', 'claude-opus-5-5', 'high'],
    ['DB', 'rfs-database-engineer', 'rfs-database-reviewer', 'claude-sonnet-5-5', 'medium'],
    ['BOT', 'rfs-ai-chatbot-engineer', 'rfs-ai-chatbot-reviewer', 'claude-sonnet-5-5', 'medium'],
    ['AUTO', 'rfs-automation-engineer', 'rfs-automation-reviewer', 'claude-sonnet-5-5', 'medium'],
  ];
  const identities = new Set();
  for (const [id, engineerProfile, reviewerProfile, engineerModel, engineerEffort] of pairs) {
    const input = { ...task, role_ref: `RFS-${id}` };
    const implementation = buildInvocation(input);
    const review = buildInvocation({
      ...input,
      role_ref: `RFS-${id}-REVIEW`,
      implementation_handoff: {
        role_ref: input.role_ref, agent_id: implementation.task_name, summary: 'Local check passed.',
      },
    });
    assert.equal(implementation.profile, engineerProfile);
    assert.equal(review.profile, reviewerProfile);
    assert.deepEqual(implementation.route, { model: engineerModel, effort: engineerEffort });
    assert.deepEqual(review.route, { model: 'claude-opus-5-5', effort: 'high' });
    assert.equal(implementation.agent.subagent_type, engineerProfile);
    assert.equal(review.agent.subagent_type, reviewerProfile);
    assert.ok(!('model' in implementation.agent) && !('model' in review.agent), 'frontmatter pins the model');
    assert.match(review.agent.prompt, /Implementation handoff from .*Local check passed/);
    assert.match(implementation.agent.prompt, /Read applicable CLAUDE\.md and \.claude\/skills\//);
    identities.add(implementation.task_name);
    identities.add(review.task_name);
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
  const first = view(buildInvocation(input));
  assert.ok(first.message.includes('frontend/src/app/api/auth/login/route.js'));
  assert.ok(!first.message.includes(readFileSync(join(root, input.relevant_paths[0]), 'utf8')));
  assert.match(first.message, /Source revision: abcdef1/);
  assert.match(first.message, /Run the Node test suite/);
  assert.match(first.message, /Use read-only local checks/);
  const retry = view(buildInvocation({ ...input, attempt: 2 }));
  assert.notEqual(first.task_name, retry.task_name);
  assert.notEqual(reviewer.task_name, buildInvocation({ ...toReview, attempt: 2 }).task_name);
});

test('review instructions increase by tier', () => {
  assert.match(reviewer.message, /check the changed behavior/);
  assert.match(buildInvocation({ ...toReview, tier: 'STANDARD' }).agent.prompt, /relevant regression/);
  assert.match(buildInvocation({ ...toReview, tier: 'FULL' }).agent.prompt, /additional risk review/);
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
  const { profile, route, task_name, agent } = buildInvocation(input);
  assert.equal(profile, 'rfs-backlog-handoff');
  assert.equal(agent.subagent_type, 'rfs-backlog-handoff');
  assert.deepEqual(route, { model: 'claude-haiku-5-5', effort: 'medium' });
  assert.match(agent.prompt, /tracker before authorized Trello actions/);
  assert.match(agent.prompt, /Preserve labels and outstanding PM acceptance/);
  assert.match(agent.prompt, /PM acceptance pending/);
  assert.throws(() => buildInvocation({ ...input, review_handoff: undefined }), /registered reviewer/);
  assert.throws(() => buildInvocation({
    ...input, review_handoff: { ...input.review_handoff, agent_id: `/root/${task_name}` },
  }), /independent specialist identity/);
});

test('review handoff accepts a completed client identity and rejects a missing or next actor ID', () => {
  const actual = '/root/reviewer_context_implementation';
  const buildWithIdentity = (agent_id) => buildInvocation({
    ...toReview, implementation_handoff: { ...toReview.implementation_handoff, agent_id },
  });
  assert.match(buildWithIdentity(actual).agent.prompt, /handoff from \/root\/reviewer_context_implementation:/);
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
    '.agents/team.json', '.agents/model-routing.json', '.claude/agents/rfs-automation-engineer.md',
    '.claude/skills/automation-implementation/SKILL.md',
  ];
  for (const path of files) {
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    copyFileSync(join(root, path), join(scratch, path));
  }
  writeFileSync(join(scratch, 'inside.txt'), 'Local evidence.');
  try {
    symlinkSync('inside.txt', join(scratch, 'alias.txt'));
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    context.skip('The host does not allow file links (Windows without Developer Mode).');
    return;
  }
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
    assert.ok(buildInvocation({ ...task, outcome: `Check ${uri}` }).agent.prompt.includes(uri));
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
  const brief = buildInvocation({ ...task, checks: ['ok'] }).agent.prompt;
  const remaining = 500 - brief.trim().split(/\s+/u).length;
  const checks = Array.from({ length: 3 }, () => 'ok '.repeat(100).trim());
  checks.push('ok '.repeat(remaining - 302).trim());
  const boundary = buildInvocation({ ...task, checks }).agent.prompt;
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

test('rejects a subagent profile whose pinned model or effort drifts from its route', (context) => {
  const scratch = mkdtempSync(join(tmpdir(), 'rfs-packet-drift-'));
  context.after(() => rmSync(scratch, { recursive: true, force: true }));
  for (const path of ['.agents/team.json', '.agents/model-routing.json', '.claude/agents/rfs-automation-engineer.md',
    '.claude/skills/automation-implementation/SKILL.md', 'tools/agent_workflow/packet.mjs']) {
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    copyFileSync(join(root, path), join(scratch, path));
  }
  const profile = join(scratch, '.claude/agents/rfs-automation-engineer.md');
  const original = readFileSync(profile, 'utf8');
  assert.equal(buildInvocation(task, { root: scratch }).agent.subagent_type, 'rfs-automation-engineer');
  for (const drift of [original.replace('effort: medium', 'effort: high'),
    original.replace('model: claude-sonnet-5-5', 'model: claude-opus-5-5'), original.replace(/^---[\s\S]*?---/, '')]) {
    writeFileSync(profile, drift);
    assert.throws(() => buildInvocation(task, { root: scratch }), /does not match its registered model route|no frontmatter/);
  }
});

test('--next derives reviewer then backlog packets from files and rejects an invalid chain', () => {
  const dir = mkdtempSync(join(tmpdir(), 'packet-next-'));
  try {
    const write = (name, value) => {
      const file = join(dir, name);
      writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
      return file;
    };
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
    const handoff = write('h.txt', 'Checks passed.\nOne gap remains.\n');

    const review = run('--next', write('eng.json', task), '--handoff', handoff);
    assert.equal(review.status, 0, review.stderr);
    const reviewOut = JSON.parse(review.stdout);
    assert.equal(reviewOut.role_ref, 'RFS-AUTO-REVIEW');
    assert.match(reviewOut.agent.prompt, new RegExp(`Implementation handoff from ${engineer.task_name}: Checks passed\. One gap remains\.`));

    const reviewerPacket = { ...toReview, implementation_handoff: { ...toReview.implementation_handoff } };
    const backlog = run('--next', write('rev.json', reviewerPacket), '--handoff', handoff);
    assert.equal(backlog.status, 0, backlog.stderr);
    const backlogOut = JSON.parse(backlog.stdout);
    assert.equal(backlogOut.role_ref, 'RFS-BACKLOG');
    assert.match(backlogOut.agent.prompt, new RegExp(`Review handoff from ${reviewer.task_name}:`));
    assert.doesNotMatch(backlogOut.agent.prompt, /Implementation handoff/);

    const chained = run('--next', write('back.json', {
      ...task, role_ref: 'RFS-BACKLOG',
      review_handoff: { role_ref: 'RFS-AUTO-REVIEW', agent_id: reviewer.task_name, summary: 'Done.' },
    }), '--handoff', handoff);
    assert.equal(chained.status, 1);
    assert.match(chained.stderr, /no next stage/);

    const patched = run('--next', write('eng2.json', task), '--handoff', handoff, '--input',
      write('p.json', { outcome: 'Patched outcome.', checks: ['Run it.'], source_revision: 'abcdef1' }));
    assert.equal(patched.status, 0, patched.stderr);
    assert.match(JSON.parse(patched.stdout).agent.prompt, /Outcome: Patched outcome\./);

    for (const bad of [{ tier: 'FULL' }, { role_ref: 'RFS-BE' }, { implementation_handoff: {} }, { outcome: 'token: abcdef' }]) {
      const rejected = run('--next', write('eng3.json', task), '--handoff', handoff, '--input', write('bad.json', bad));
      assert.equal(rejected.status, 1, JSON.stringify(bad));
    }
    const long = run('--next', write('eng4.json', task), '--handoff', write('long.txt', 'word '.repeat(201)));
    assert.equal(long.status, 1);
    assert.match(long.stderr, /exceeds 200 words/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejections for a missing agent_id or stale handoff field name the fix', () => {
  const { agent_id, ...noId } = toReview.implementation_handoff;
  assert.throws(() => buildInvocation({ ...toReview, implementation_handoff: noId }), /set agent_id to the previous stage's task_name/);
  assert.throws(() => buildInvocation({ ...toReview, review_handoff: noId }), /drop implementation_handoff/);
});
