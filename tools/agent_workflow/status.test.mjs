import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBoardList } from './status.mjs';

const canonicalRoutes = [
  ['Open', 'READY'],
  ['Partial', 'IN PROGRESS'],
  ['Verify release', 'IN REVIEW'],
  ['Done', 'DONE'],
  ['Deferred', null],
];
const knowledgeBase = { origin: 'knowledge_base' };
const decision = { pmReviewed: true, pmDecisionRef: 'review_decisions.json#example-decision' };

test('preserves each canonical route for existing manual tasks', () => {
  for (const [trackerStatus, list] of canonicalRoutes) {
    assert.equal(resolveBoardList({ trackerStatus, origin: 'manual' }), list);
  }
});

test('routes only unreviewed knowledge-base proposals to the Open list', () => {
  const proposal = { ...knowledgeBase, trackerStatus: 'Proposed' };
  assert.equal(resolveBoardList(Object.freeze(proposal)), 'Open');
  assert.equal(resolveBoardList({ ...proposal, pmReviewed: false }), 'Open');
  assert.throws(() => resolveBoardList({ ...proposal, origin: 'manual' }), /reserved/);
  assert.throws(() => resolveBoardList({ ...proposal, ...decision }), /reserved/);
});

test('requires both review fields for every canonical knowledge-base route', () => {
  for (const [trackerStatus, list] of canonicalRoutes) {
    const task = { ...knowledgeBase, trackerStatus };
    assert.throws(() => resolveBoardList(task), /require a recorded PM review/);
    assert.throws(() => resolveBoardList({ ...task, pmReviewed: true }), /supplied together/);
    assert.throws(() => resolveBoardList({ ...task, pmDecisionRef: decision.pmDecisionRef }), /supplied together/);
    assert.equal(resolveBoardList({ ...task, ...decision }), list);
  }
});

test('rejects malformed evidence and unknown or inherited status names', () => {
  const task = { ...knowledgeBase, trackerStatus: 'Open', ...decision };
  for (const pmDecisionRef of ['', '  ', null, 12]) {
    assert.throws(() => resolveBoardList({ ...task, pmDecisionRef }), /nonempty/);
  }
  for (const pmReviewed of ['true', 1, null]) {
    assert.throws(() => resolveBoardList({ ...task, pmReviewed }), /boolean/);
  }
  for (const trackerStatus of ['open', 'IN REVIEW', 'constructor', undefined]) {
    assert.throws(() => resolveBoardList({ ...task, trackerStatus }), /Unknown tracker status/);
  }
  for (const origin of ['research', undefined]) {
    assert.throws(() => resolveBoardList({ ...task, origin }), /Unknown task origin/);
  }
});
