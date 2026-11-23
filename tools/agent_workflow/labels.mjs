import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../../.agents/board-policy.json', import.meta.url), 'utf8'));

/**
 * Plan label additions from a complete board label catalog and a fresh card read.
 * Return missing IDs in policy order. Conflicts throw before any IDs are returned.
 */
export function planLabelAdditions({ task, boardLabels, currentLabelIds }) {
  if (!task || !Array.isArray(task.domains) || !task.domains.length
      || new Set(task.domains).size !== task.domains.length
      || task.domains.some((name) => !policy.domains.includes(name))
      || !policy.tiers.includes(task.tier)) {
    throw new Error('A task must have relevant domain labels and exactly one valid delivery tier.');
  }
  if (!Array.isArray(boardLabels) || !Array.isArray(currentLabelIds)) {
    throw new Error('The board label catalog and current card label IDs are required.');
  }

  const idsByName = new Map();
  const namesById = new Map();
  for (const label of boardLabels) {
    if (typeof label?.id !== 'string' || !label.id.trim() || typeof label.name !== 'string') {
      throw new Error('Board labels must have a nonempty ID and a string name.');
    }
    if (namesById.has(label.id)) {
      throw new Error(`Duplicate board label ID: ${label.id}.`);
    }
    namesById.set(label.id, label.name);
    // Trello can have several unnamed color labels. They are preserved by ID.
    if (!label.name.trim()) continue;
    if (idsByName.has(label.name)) {
      throw new Error(`Duplicate board label name: "${label.name}".`);
    }
    idsByName.set(label.name, label.id);
  }
  for (const name of [...policy.domains, ...policy.tiers]) {
    if (!idsByName.has(name)) {
      throw new Error(`Missing board label: "${name}".`);
    }
  }

  const existingIds = new Set(currentLabelIds);
  for (const id of existingIds) {
    if (!namesById.has(id)) {
      throw new Error('A current card label ID is missing from the board catalog.');
    }
    const name = namesById.get(id);
    if (policy.tiers.includes(name) && name !== task.tier) {
      throw new Error(`Conflicting delivery tier: existing "${name}", planned "${task.tier}".`);
    }
  }

  const desiredNames = [...policy.domains.filter((name) => task.domains.includes(name)), task.tier];
  const desiredIds = desiredNames.map((name) => idsByName.get(name));
  return desiredIds.filter((id) => !existingIds.has(id));
}
