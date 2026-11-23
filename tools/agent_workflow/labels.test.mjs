import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planLabelAdditions } from './labels.mjs';

const repoRoot = new URL('../../', import.meta.url);
const policy = JSON.parse(readFileSync(new URL('.agents/board-policy.json', repoRoot), 'utf8'));
const team = JSON.parse(readFileSync(new URL('.agents/team.json', repoRoot), 'utf8'));
const plan = JSON.parse(readFileSync(new URL('docs/agents/TRELLO_LABEL_PLAN.json', repoRoot), 'utf8'));
const boardLabels = [
  { id: 'front', name: 'Front end Dev' },
  { id: 'back', name: 'Backend Dev' },
  { id: 'database', name: 'Db Dev' },
  { id: 'security', name: 'Security Dev' },
  { id: 'chatbot', name: 'Bot Dev' },
  { id: 'automation', name: 'Automation Dev' },
  { id: 'quick', name: 'QUICK' },
  { id: 'standard', name: 'STANDARD' },
  { id: 'full', name: 'FULL' },
  { id: 'priority', name: 'PM priority' },
  { id: 'green', name: '' },
  { id: 'yellow', name: '' },
];
const task = { domains: ['Backend Dev', 'Front end Dev'], tier: 'STANDARD' };

test('plans only missing IDs in deterministic order and preserves original inputs', () => {
  const currentLabelIds = Object.freeze(['priority', 'back', 'security', 'green', 'yellow']);
  const catalog = Object.freeze(boardLabels.map((label) => Object.freeze(label)));
  const frozenTask = Object.freeze({ ...task, domains: Object.freeze([...task.domains]) });
  const input = { task: frozenTask, boardLabels: catalog, currentLabelIds };

  assert.deepEqual(planLabelAdditions(input), ['front', 'standard']);
  assert.deepEqual(planLabelAdditions(input), ['front', 'standard']);
  assert.deepEqual(planLabelAdditions({
    task: { ...task, domains: [...task.domains].reverse() },
    boardLabels: [...catalog].reverse(),
    currentLabelIds: [...currentLabelIds].reverse(),
  }), ['front', 'standard']);
  assert.deepEqual(currentLabelIds, ['priority', 'back', 'security', 'green', 'yellow']);
  assert.deepEqual(frozenTask, task);
});

test('replans safely after a partial application and returns no additions after completion', () => {
  const currentLabelIds = ['priority', 'front'];
  const args = { task, boardLabels, currentLabelIds };
  const [first, second] = planLabelAdditions(args);
  assert.equal(first, 'back');
  assert.equal(second, 'standard');

  const partial = [...currentLabelIds, first];
  assert.deepEqual(planLabelAdditions({ ...args, currentLabelIds: partial }), [second]);
  assert.deepEqual(planLabelAdditions({ ...args, currentLabelIds: [...partial, second] }), []);
});

test('rejects a different tier even when the desired tier is already present', () => {
  for (const currentLabelIds of [['quick', 'priority'], ['standard', 'full']]) {
    assert.throws(() => planLabelAdditions({ task, boardLabels, currentLabelIds }),
      /Conflicting delivery tier/);
  }
});

test('rejects duplicate exact board names, including unrelated named labels', () => {
  for (const name of ['Front end Dev', 'STANDARD', 'PM priority']) {
    const catalog = [...boardLabels, { id: 'duplicate', name }];
    assert.throws(() => planLabelAdditions({ task, boardLabels: catalog, currentLabelIds: [] }),
      /Duplicate board label name/);
  }
});

test('rejects duplicate board IDs that make tier detection ambiguous', () => {
  const catalog = [...boardLabels, { id: 'full', name: 'Another label' }];
  assert.throws(() => planLabelAdditions({ task, boardLabels: catalog, currentLabelIds: ['full'] }),
    /Duplicate board label ID/);
});

test('rejects missing exact names and unresolved existing IDs', () => {
  const catalog = boardLabels.map((label) => label.name === 'STANDARD'
    ? { ...label, name: 'standard' }
    : label);
  assert.throws(() => planLabelAdditions({ task, boardLabels: catalog, currentLabelIds: [] }),
    /Missing board label: "STANDARD"/);
  assert.throws(() => planLabelAdditions({ task, boardLabels, currentLabelIds: ['unknown'] }),
    /current card label ID is missing/);
});

test('requires all policy labels even when the task needs only a subset', () => {
  const backendTask = { domains: ['Backend Dev'], tier: 'STANDARD' };
  for (const name of [...policy.domains, ...policy.tiers]) {
    const catalog = boardLabels.filter((label) => label.name !== name);
    assert.throws(() => planLabelAdditions({
      task: backendTask, boardLabels: catalog, currentLabelIds: ['priority'],
    }), { message: `Missing board label: "${name}".` });
  }
});

test('requires nonempty distinct policy domains and one exact tier', () => {
  for (const invalidTask of [
    { ...task, domains: [] },
    { ...task, domains: ['frontend'] },
    { ...task, domains: ['Backend Dev', 'Backend Dev'] },
    { ...task, tier: ['STANDARD', 'FULL'] },
    { ...task, tier: 'standard' },
  ]) {
    assert.throws(() => planLabelAdditions({ task: invalidTask, boardLabels, currentLabelIds: [] }),
      /domain labels and exactly one valid delivery tier/);
  }
});

test('covers exactly the 68 numbered cards with the registry domain names and all three tiers', () => {
  const tracker = readFileSync(new URL('docs/product/IMPROVEMENT_TRACKER.md', repoRoot), 'utf8');
  const trackerScope = new Map(
    [...tracker.matchAll(/^- \[[ x]\] \*\*(\d+)\. (.*?) — (.*?)\*\*/gm)]
      .filter(([, , , status]) => !status.startsWith('Deferred'))
      .map(([, id, title]) => [Number(id), title]),
  );

  assert.deepEqual(new Set(policy.domains), new Set(team.specialists.map((role) => role.domain_label)));
  assert.deepEqual(policy.domains, boardLabels.slice(0, 6).map((label) => label.name));
  assert.deepEqual(policy.tiers, ['QUICK', 'STANDARD', 'FULL']);
  assert.equal(policy.label_updates, 'add_only');
  assert.equal(policy.board_id, plan.board_id);
  assert.equal(plan.tasks.length, 68);
  assert.equal(new Set(plan.tasks.map((entry) => entry.card_id)).size, 68);
  assert.equal(new Set(plan.tasks.map((entry) => entry.task_id)).size, 68);
  assert.deepEqual(new Map(plan.tasks.map((entry) => [entry.task_id, entry.title])), trackerScope);
  assert.deepEqual(new Set(plan.tasks.flatMap((entry) => entry.domains)), new Set(policy.domains));
  assert.deepEqual(new Set(plan.tasks.map((entry) => entry.tier)), new Set(policy.tiers));

  const labelsById = new Map(boardLabels.map((label) => [label.id, label.name]));
  for (const entry of plan.tasks) {
    assert.match(entry.card_id, /^ari:cloud:trello::card\/workspace\/[0-9a-f]{24}\/[0-9a-f]{24}$/);
    assert.match(entry.rationale, /\S/);
    const input = { task: entry, boardLabels, currentLabelIds: ['priority'] };
    const additions = planLabelAdditions(input);
    const names = additions.map((id) => labelsById.get(id));
    assert.deepEqual(new Set(names), new Set([...entry.domains, entry.tier]));
    assert.deepEqual(planLabelAdditions({ ...input, currentLabelIds: ['priority', ...additions] }), []);
  }
});
