import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const maxInputBytes = 12_000;
const tiers = {
  QUICK: 'Independently check the changed behavior against the acceptance criteria.',
  STANDARD: 'Independently check acceptance and run relevant regression checks.',
  FULL: 'Independently check acceptance and regressions, with any additional risk review selected by triage.',
};

const taskFields = [
  'task_id', 'workflow_id', 'tier', 'role_ref', 'outcome', 'acceptance_criteria',
  'relevant_paths', 'approval_limits', 'attempt', 'source_revision', 'checks',
  'implementation_handoff', 'review_handoff',
];

const privatePath = /^(?:\.(?:env(?:rc)?|git|ssh|aws|docker|workflow-usage|npmrc|netrc|pypirc|pgpass|htpasswd|secrets?|credentials?|temp|next)(?:[.-]|$)|node_modules$|(?:id_(?:rsa|ed25519|ecdsa|dsa)|settings\.local|credentials?|secrets?|private|transcripts?|logs?)(?:[._-]|$)|(?:auth|cookies|service[._-]account)\.json$)|\.(?:log|jsonl|pem|key|p12|pfx|jks|sqlite3?|db)$/i;
const privateText = /(?:(?:\b|_)(?:password|passwd|api[_ -]?key|token|secret|authorization)\s*[:=]\s*\S|\bBearer\s+[\w.-]{12,}|\b(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-|sb_secret_)[\w-]{16,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\beyJ[\w-]+\.[\w-]+\.[\w-]+\b|-----BEGIN |\u0060{3}|~~~)/i;
const uriUserinfo = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/?#@]+@/i;

function words(value) {
  return value.trim().split(/\s+/u).length;
}

function checkObject(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !fields.includes(key))) {
    throw new Error(`Invalid ${label} fields.`);
  }
}

function textField(value, label, maxLength = 600) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength
      || /[\p{C}\p{Zl}\p{Zp}]/u.test(value) || privateText.test(value) || uriUserinfo.test(value)) {
    throw new Error(`${label} must be bounded, sanitized, single-line text.`);
  }
  return value.trim();
}

function textList(values, label, limit) {
  if (!Array.isArray(values) || !values.length || values.length > limit) {
    throw new Error(`${label} must contain 1 to ${limit} entries.`);
  }
  return values.map((value) => textField(value, label));
}

function checkFile(root, path) {
  const segments = typeof path === 'string' ? path.split('/') : [];
  if (!segments.length || path.length > 250 || isAbsolute(path)
      || segments.some((segment) => !/^[\p{L}\p{N}._ @()[\],+-]+$/u.test(segment)
        || segment !== segment.trim() || segment === '.' || segment === '..' || privatePath.test(segment))) {
    throw new Error('Paths must name non-sensitive, repository-relative files.');
  }

  const absolute = join(root, path);
  try {
    if (realpathSync(absolute) !== absolute || !statSync(absolute).isFile()) {
      throw new Error();
    }
  } catch {
    throw new Error('A packet path is missing, linked, or is not a regular file.');
  }
  return path;
}

// Reads the flat `key: value` frontmatter of a Claude Code subagent profile.
function frontmatter(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!block) throw new Error('The subagent profile has no frontmatter.');
  return Object.fromEntries(block[1].split(/\r?\n/).map((line) => /^([a-zA-Z]+):\s*(.*)$/.exec(line))
    .filter(Boolean).map(([, key, value]) => [key, value.trim()]));
}

function readConfig(root, path) {
  return JSON.parse(readFileSync(join(root, checkFile(root, path)), 'utf8'));
}

function taskName(input, profile, attempt) {
  return `${input.workflow_id}_${input.task_id.slice(1)}_${profile}_${attempt}`;
}

function handoff(value, stage, roleRef, nextName) {
  checkObject(value, ['role_ref', 'agent_id', 'summary'], `${stage} handoff`);
  if (value && typeof value.agent_id !== 'string') {
    throw new Error(`The ${stage} handoff must identify the expected completed specialist: set agent_id to the previous stage's task_name (or use --next).`);
  }
  if (value.role_ref !== roleRef || value.agent_id.length > 180
      || !/^\/?[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)*$/i.test(value.agent_id)
      || privateText.test(value.agent_id)) {
    throw new Error(`The ${stage} handoff must identify the expected completed specialist.`);
  }
  if (value.agent_id.split('/').at(-1).toLowerCase() === nextName) {
    throw new Error('The next stage requires an independent specialist identity.');
  }
  const summary = textField(value.summary, `${stage} handoff`, 2_000);
  if (words(summary) > 200) {
    throw new Error(`The ${stage} handoff exceeds 200 words.`);
  }
  return `${stage} handoff from ${value.agent_id}: ${summary}`;
}

export function buildInvocation(input, { root = repoRoot } = {}) {
  root = realpathSync(root);
  checkObject(input, taskFields, 'task packet');
  if (typeof input.task_id !== 'string' || !/^#[1-9]\d{0,5}$/.test(input.task_id)
      || typeof input.workflow_id !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(input.workflow_id)) {
    throw new Error('A numbered task_id and a short workflow_id are required.');
  }
  if (typeof input.tier !== 'string' || !Object.hasOwn(tiers, input.tier)) {
    throw new Error('Tier must be QUICK, STANDARD, or FULL.');
  }
  const attempt = Object.hasOwn(input, 'attempt') ? input.attempt : 1;
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) {
    throw new Error('Attempt must be 1, 2, or 3.');
  }
  if (Object.hasOwn(input, 'source_revision')
      && (typeof input.source_revision !== 'string' || !/^[a-f0-9]{7,64}$/i.test(input.source_revision))) {
    throw new Error('Source revision must be a commit hash.');
  }

  const team = readConfig(root, '.agents/team.json');
  const { routes } = readConfig(root, '.agents/model-routing.json');
  const pair = team.specialists.find(({ role_ref, reviewer }) => (
    role_ref === input.role_ref || reviewer.role_ref === input.role_ref
  ));
  const backlog = team.coordination.backlog_handoff;
  const isReview = Boolean(pair && pair.reviewer.role_ref === input.role_ref);
  const isBacklog = backlog.role_ref === input.role_ref;
  const role = isBacklog ? backlog : isReview ? pair.reviewer : pair?.engineer;
  if (!role) {
    throw new Error('A registered engineer, reviewer, or backlog role_ref is required.');
  }
  const route = Object.hasOwn(routes, role.model_route) && routes[role.model_route];
  if (!route?.model || !route.reasoning_effort || !role.profile) {
    throw new Error('The registered role has an incomplete model route.');
  }

  const name = taskName(input, role.profile, attempt);
  let previous;
  if (isReview) {
    previous = handoff(input.implementation_handoff, 'Implementation', pair.role_ref, name);
  } else if (isBacklog) {
    const reviewer = team.specialists.find(({ reviewer }) => reviewer.role_ref === input.review_handoff?.role_ref)?.reviewer;
    if (!reviewer) {
      throw new Error('Backlog handoff requires a registered reviewer.');
    }
    previous = handoff(input.review_handoff, 'Review', reviewer.role_ref, name);
  }
  if ((!isReview && Object.hasOwn(input, 'implementation_handoff'))
      || (!isBacklog && Object.hasOwn(input, 'review_handoff'))) {
    throw new Error('A handoff is only accepted for its next stage: drop implementation_handoff from reviewer/backlog packets and review_handoff from engineer/reviewer packets (or use --next).');
  }

  const profile = checkFile(root, role.profile_path);
  const pinned = frontmatter(readFileSync(join(root, profile), 'utf8'));
  if (pinned.name !== role.profile || pinned.model !== route.model || pinned.effort !== route.reasoning_effort) {
    throw new Error('The subagent profile name, model, or effort does not match its registered model route.');
  }
  const skill = checkFile(root, role.skill_path);
  const outcome = textField(input.outcome, 'Outcome');
  const criteria = textList(input.acceptance_criteria, 'Acceptance criteria', 8);
  const approvals = textList(input.approval_limits, 'Approval limits', 6);
  const checks = Object.hasOwn(input, 'checks') ? textList(input.checks, 'Checks', 8) : [];
  if (!Array.isArray(input.relevant_paths) || !input.relevant_paths.length || input.relevant_paths.length > 12) {
    throw new Error('Relevant paths must contain 1 to 12 files.');
  }
  const paths = input.relevant_paths.map((path) => checkFile(root, path));

  const message = [
    `${input.task_id} · ${input.workflow_id} · ${pair?.workflow_ref ?? backlog.workflow_ref} · ${input.role_ref} · ${input.tier} · attempt ${attempt}`,
    `Work in "${root}". Read applicable CLAUDE.md and ${skill} for this assignment.`,
    `Outcome: ${outcome}`,
    input.source_revision && `Source revision: ${input.source_revision}`,
    'Acceptance criteria:', ...criteria.map((criterion) => `- ${criterion}`),
    'Relevant files:', ...paths.map((path) => `- ${path}`),
    checks.length > 0 && 'Checks:', ...checks.map((check) => `- ${check}`),
    'Approval and mutation limits:', ...approvals.map((approval) => `- ${approval}`),
    previous,
    isReview && `${tiers[input.tier]} Review only. Report any defect to the coordinator. Do not edit implementation or approve your own work.`,
    isBacklog && 'Record the reviewed outcome in the tracker before authorized Trello actions. Preserve labels and outstanding PM acceptance.',
    'End the turn with a handoff of at most 200 words. Report actual checks, gaps, and the next action.',
  ].filter(Boolean).join('\n');
  if (words(message) > 500 || message.length > 6_000) {
    throw new Error('The generated briefing exceeds the 500-word or 6000-character limit.');
  }

  // Claude Code Agent tool call. The subagent's frontmatter pins model, effort and tools,
  // and every subagent starts in a fresh context, so no model override or fork is sent.
  return {
    role_ref: input.role_ref,
    profile: role.profile,
    task_name: name,
    route: { model: route.model, effort: route.reasoning_effort },
    agent: { subagent_type: role.profile, description: `${input.task_id} ${input.role_ref} attempt ${attempt}`, prompt: message },
  };
}

const patchFields = ['outcome', 'acceptance_criteria', 'relevant_paths', 'checks', 'approval_limits', 'source_revision'];

function readJsonFile(path, label) {
  try {
    const absolute = resolve(path);
    if (statSync(absolute).size > maxInputBytes) throw new Error(`${label} is too large.`);
    return JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(/too large/.test(error.message) ? error.message : `${label} must be a readable JSON file.`);
  }
}

// Derives the next stage's task packet from the previous stage's packet and its handoff text.
export function buildNext(previous, handoffText, patch, { root = repoRoot } = {}) {
  const previousName = buildInvocation(previous, { root }).task_name;
  const team = readConfig(realpathSync(root), '.agents/team.json');
  const pair = team.specialists.find(({ role_ref, reviewer }) => (
    role_ref === previous.role_ref || reviewer.role_ref === previous.role_ref
  ));
  let nextRole;
  let field;
  if (pair?.role_ref === previous.role_ref) {
    [nextRole, field] = [pair.reviewer.role_ref, 'implementation_handoff'];
  } else if (pair) {
    [nextRole, field] = [team.coordination.backlog_handoff.role_ref, 'review_handoff'];
  } else {
    throw new Error('--next needs a previous engineer or reviewer packet; a backlog packet has no next stage.');
  }
  if (patch !== undefined) {
    checkObject(patch, patchFields, '--input patch (allowed: ' + patchFields.join(', ') + ')');
  }
  if (typeof handoffText !== 'string') throw new Error('Provide the handoff text file.');
  const next = { ...previous, ...patch, role_ref: nextRole };
  delete next.implementation_handoff;
  delete next.review_handoff;
  next[field] = {
    role_ref: previous.role_ref,
    agent_id: previousName,
    summary: handoffText.replace(/\s+/g, ' ').trim(),
  };
  return next;
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} needs a file path.`);
  return args[index + 1];
}

function nextInput(args) {
  const allowed = ['--next', '--handoff', '--input', '--save'];
  const usage = 'Usage: packet.mjs --next PREVIOUS.json --handoff HANDOFF.txt [--input PATCH.json] [--save NEXT.json]';
  if (args.some((arg, i) => arg.startsWith('--') ? !allowed.includes(arg) : !allowed.includes(args[i - 1]))) {
    throw new Error(usage);
  }
  const previousPath = argValue(args, '--next');
  const handoffPath = argValue(args, '--handoff');
  const patchPath = argValue(args, '--input');
  const savePath = argValue(args, '--save');
  if (!previousPath || !handoffPath) {
    throw new Error(usage);
  }
  if (savePath) {
    const target = resolve(savePath);
    if ([previousPath, handoffPath, patchPath].some((path) => path && resolve(path) === target)) {
      throw new Error('--save must not name the --next, --handoff or --input file.');
    }
    if (existsSync(target)) throw new Error('--save will not overwrite an existing file.');
  }
  let text;
  try {
    if (statSync(handoffPath).size > maxInputBytes) throw new Error();
    text = readFileSync(handoffPath, 'utf8');
  } catch {
    throw new Error('The handoff must be a readable text file within the size limit.');
  }
  return {
    savePath,
    next: buildNext(
      readJsonFile(previousPath, 'The previous packet'),
      text,
      patchPath ? readJsonFile(patchPath, 'The patch') : undefined,
    ),
  };
}

async function main() {
  try {
    if (process.argv.length > 2) {
      const { next, savePath } = nextInput(process.argv.slice(2));
      const invocation = buildInvocation(next);
      if (savePath) {
        try {
          writeFileSync(resolve(savePath), JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
        } catch {
          throw new Error('--save could not create the file (it must be a new, writable path).');
        }
      }
      process.stdout.write(JSON.stringify(invocation, null, 2) + '\n');
      return;
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > maxInputBytes) throw new Error('Task packet JSON is too large.');
      chunks.push(chunk);
    }
    let input;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('Provide valid task packet JSON on stdin.');
    }
    process.stdout.write(JSON.stringify(buildInvocation(input), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`Task packet rejected: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
