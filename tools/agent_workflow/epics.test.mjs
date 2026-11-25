import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEpicGroups } from './epics.mjs';

function task(number, names, overrides = {}) {
  return {
    id: `card-${number}`,
    name: `#${number} — Task ${number}`,
    url: `https://trello.com/c/short${number}/${number}-task`,
    labels: names.map((name, index) => ({ id: `label-${index}`, name })),
    labelsHasMore: false,
    ...overrides,
  };
}

test('builds all six indexes in policy order with exact ordered domain membership and labels', () => {
  const cards = [
    task(10, ['FULL', 'Backend Dev', 'Front end Dev', 'Db Dev'], { list: 'DONE' }),
    task(2, ['Front end Dev', 'Automation Dev', 'QUICK', 'Other', ''], { list: 'Open' }),
    task(4, ['Db Dev', 'Security Dev', 'STANDARD'], { list: 'IN REVIEW' }),
  ];
  const original = structuredClone(cards);
  for (const card of cards) {
    card.labels.forEach(Object.freeze);
    Object.freeze(card.labels);
    Object.freeze(card);
  }
  Object.freeze(cards);

  const groups = buildEpicGroups(cards);
  assert.deepEqual(groups.map(({ title, childTaskIds }) => [title, childTaskIds]), [
    ['EPIC — Front end Development', [2, 10]],
    ['EPIC — Backend Development', [10]],
    ['EPIC — Db Dev', [4, 10]],
    ['EPIC — Security Dev', [4]],
    ['EPIC — Bot Dev', []],
    ['EPIC — Automation Dev', [2]],
  ]);
  assert.deepEqual(groups.map(({ labels }) => labels), [
    ['Front end Dev', 'FULL'], ['Backend Dev', 'FULL'], ['Db Dev', 'FULL'],
    ['Security Dev', 'FULL'], ['Bot Dev', 'FULL'], ['Automation Dev', 'FULL'],
  ]);
  assert.deepEqual(groups[0].description.split('\n').slice(-2), [
    '- [#2 — Task 2](https://trello.com/c/short2/2-task) `QUICK`',
    '- [#10 — Task 10](https://trello.com/c/short10/10-task) `FULL`',
  ]);
  assert.match(groups[2].description, /\[#4 — Task 4\]\(https:\/\/trello\.com\/c\/short4\/4-task\) `STANDARD`/);
  assert.match(groups[4].description, /No matching tasks\.$/);
  assert.deepEqual(buildEpicGroups([...cards].reverse()), groups);
  assert.deepEqual(cards, original);
  assert.equal(buildEpicGroups([]).length, 6);
});

test('rejects duplicate task numbers, card IDs and Trello short links', () => {
  const first = task(2, ['QUICK', 'Bot Dev']);
  for (const second of [
    task(3, ['QUICK', 'Security Dev'], { name: '#2 — Different task' }),
    task(3, ['QUICK', 'Security Dev'], { id: first.id }),
    task(3, ['QUICK', 'Security Dev'], { url: 'https://trello.com/c/short2/different-slug' }),
  ]) {
    assert.throws(() => buildEpicGroups([first, second]), /Duplicate task or card identity/);
  }
});

test('rejects incomplete, malformed, duplicate and conflicting labels', () => {
  const valid = task(2, ['QUICK', 'Bot Dev']);
  assert.throws(() => buildEpicGroups([{ ...valid, labelsHasMore: true }]), /complete label read/);
  assert.throws(() => buildEpicGroups([{ ...valid, labels: undefined }]), /complete label read/);
  for (const names of [['Bot Dev'], ['QUICK'], ['Bot Dev', 'quick'], ['bot Dev', 'QUICK'],
    ['Bot Dev', 'QUICK', 'FULL'], ['Bot Dev', 'QUICK', 'QUICK'], ['Bot Dev', 'Bot Dev', 'QUICK']]) {
    assert.throws(() => buildEpicGroups([task(2, names)]), /unique domain labels and exactly one delivery tier/);
  }
  for (const label of [null, { id: '', name: 'Other' }, { id: 'label-2' }, { id: 'label-0', name: 'Other' }]) {
    assert.throws(() => buildEpicGroups([{ ...valid, labels: [...valid.labels, label] }]), /invalid or duplicate label entry/);
  }
});

test('validates numbered names and embeds only escaped titles and direct HTTPS Trello card links', () => {
  const valid = task(2, ['QUICK', 'Bot Dev'], { name: '#2 — [test](https://example.com) <b>' });
  assert.ok(buildEpicGroups([valid])[4].description.endsWith(
    '- [#2 — \\[test\\]\\(https://example.com\\) \\<b\\>](https://trello.com/c/short2/2-task) `QUICK`',
  ));
  for (const name of ['EPIC — Bot Dev', '#0 — Task', '#02 — Task', '#9007199254740992 — Task', '#2 — A\nTask']) {
    assert.throws(() => buildEpicGroups([{ ...valid, name }]), /valid numbered task title/);
  }
  for (const url of [
    'javascript:alert(1)', 'http://trello.com/c/short2', 'https://trello.com.evil.example/c/short2',
    'https://trello.com@evil.example/c/short2', 'https://trello.com/b/short2', 'https://trello.com/c/short2/..',
    'https://trello.com/c/short2?redirect=https://example.com/', 'https://trello.com/c/short2\n',
    'https://trello.com/c/short2) [attack](https://example.com)',
  ]) {
    assert.throws(() => buildEpicGroups([{ ...valid, url }]), /safe Trello card URL/);
  }
});
