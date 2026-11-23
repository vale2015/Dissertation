import policy from '../../.agents/board-policy.json' with { type: 'json' };

const numberedTitle = /^#([1-9]\d*) — (.+)$/u;
const trelloCardUrl = /^https:\/\/trello\.com\/c\/([a-zA-Z0-9]+)(?:\/[a-zA-Z0-9_-]+)?\/?$/u;

/** Build the six epic index specs from the complete, fresh numbered card read. */
export function buildEpicGroups(cards) {
  if (!Array.isArray(cards)) throw new Error('Numbered cards must be an array.');

  const taskIds = new Set();
  const cardIds = new Set();
  const shortLinks = new Set();
  const tasks = Array.from(cards, (card) => {
    const title = typeof card?.name === 'string' && card.name.match(numberedTitle);
    const taskId = Number(title?.[1]);
    if (!title || !Number.isSafeInteger(taskId) || !title[2].trim()
        || /[\p{Cc}\u2028\u2029]/u.test(card.name)) {
      throw new Error('Every source card needs a valid numbered task title.');
    }
    if (typeof card.id !== 'string' || !card.id || card.id !== card.id.trim()) {
      throw new Error(`Task #${taskId} needs a valid card ID.`);
    }
    const link = typeof card.url === 'string' && card.url.match(trelloCardUrl);
    if (!link || link[0] !== card.url) throw new Error(`Task #${taskId} needs a safe Trello card URL.`);
    if (taskIds.has(taskId) || cardIds.has(card.id) || shortLinks.has(link[1])) {
      throw new Error(`Duplicate task or card identity at #${taskId}.`);
    }
    taskIds.add(taskId);
    cardIds.add(card.id);
    shortLinks.add(link[1]);

    if (!Array.isArray(card.labels) || (card.labelsHasMore !== undefined && card.labelsHasMore !== false)) {
      throw new Error(`Task #${taskId} needs a complete label read.`);
    }
    const labelIds = new Set();
    const names = Array.from(card.labels, (label) => {
      if (typeof label?.id !== 'string' || !label.id.trim() || typeof label.name !== 'string'
          || labelIds.has(label.id)) {
        throw new Error(`Task #${taskId} has an invalid or duplicate label entry.`);
      }
      labelIds.add(label.id);
      return label.name;
    });
    const domains = names.filter((name) => policy.domains.includes(name));
    const tiers = names.filter((name) => policy.tiers.includes(name));
    if (!domains.length || new Set(domains).size !== domains.length || tiers.length !== 1) {
      throw new Error(`Task #${taskId} needs unique domain labels and exactly one delivery tier.`);
    }

    const escapedTitle = title[2].replace(/[\\`*_[\]{}()<>!|~&]/g, '\\$&');
    const row = `- [#${taskId} — ${escapedTitle}](${card.url}) \`${tiers[0]}\``;
    return { taskId, domains, row };
  }).sort((a, b) => a.taskId - b.taskId);

  return policy.domains.map((domain) => {
    const children = tasks.filter((task) => task.domains.includes(domain));
    return {
      domain,
      title: policy.epics.titles_by_domain[domain],
      description: [
        'The Markdown improvement tracker is authoritative for task status and acceptance evidence.',
        '',
        '## Linked tasks',
        '',
        children.length ? children.map((task) => task.row).join('\n') : 'No matching tasks.',
      ].join('\n'),
      childTaskIds: children.map((task) => task.taskId),
      labels: [domain, policy.epics.tier],
    };
  });
}
