import policy from '../../.agents/board-policy.json' with { type: 'json' };

const statusToList = Object.freeze({ ...policy.status_to_list });

/** Resolve a list from a handoff state. The coordinator verifies the PM decision. */
export function resolveBoardList({ trackerStatus, origin, pmReviewed = false, pmDecisionRef }) {
  if (typeof trackerStatus !== 'string' || !Object.hasOwn(statusToList, trackerStatus)) {
    throw new Error('Unknown tracker status.');
  }
  if (origin !== 'manual' && origin !== 'knowledge_base') {
    throw new Error('Unknown task origin.');
  }
  if (typeof pmReviewed !== 'boolean') {
    throw new Error('pmReviewed must be a boolean.');
  }
  const hasDecisionRef = pmDecisionRef !== undefined;
  if (hasDecisionRef && (typeof pmDecisionRef !== 'string' || !pmDecisionRef.trim())) {
    throw new Error('pmDecisionRef must be a nonempty recorded decision reference.');
  }
  if (pmReviewed !== hasDecisionRef) {
    throw new Error('A PM review flag and a recorded decision reference must be supplied together.');
  }

  if (trackerStatus === 'Proposed') {
    if (origin !== 'knowledge_base' || pmReviewed) {
      throw new Error('Proposed is reserved for unreviewed knowledge-base proposals.');
    }
  } else if (origin === 'knowledge_base' && !pmReviewed) {
    throw new Error('Knowledge-base proposals require a recorded PM review before leaving Proposed.');
  }

  return statusToList[trackerStatus];
}
