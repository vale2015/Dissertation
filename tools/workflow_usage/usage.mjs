import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const namePattern = /^[a-z\d][a-z\d._-]{0,63}$/i;
const responsePattern = /^[a-z\d][a-z\d._-]{0,255}$/i;
const agentFilePattern = /^agent-([a-z\d][a-z\d._-]{0,63})\.jsonl$/i;
const efforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const fields = [
  'input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens',
  'reasoning_output_tokens', 'total_tokens', 'uncached_input_tokens',
];
export const usageSource = 'claude_code_transcript_usage';
const coverageNote = 'Counts reflect deduplicated API response records present in local Claude Code transcripts at capture. Missing sessions, unrecorded requests and later writes may be absent.';

export function defaultTranscriptDir(env = process.env) {
  const config = typeof env.CLAUDE_CONFIG_DIR === 'string' && env.CLAUDE_CONFIG_DIR ? env.CLAUDE_CONFIG_DIR : join(homedir(), '.claude');
  return join(config, 'projects');
}

function uuid(value) {
  return typeof value === 'string' && uuidPattern.test(value) ? value.toLowerCase() : null;
}

function timestamp(value) {
  if (typeof value !== 'string') return NaN;
  const parts = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return NaN;
  const day = new Date(parts[1]);
  if (!Number.isFinite(day.getTime()) || !day.toISOString().startsWith(parts[1])) return NaN;
  return Date.parse(value);
}

function isWithin(path, root) {
  const suffix = relative(root, path);
  return !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('..' + sep);
}

async function openTranscript(path, root) {
  if (!(await lstat(path)).isFile() || !isWithin(await realpath(path), root)) {
    throw new Error('Transcript is outside the selected directory or is not a regular file.');
  }
  return open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
}

// Claude Code subagent IDs are not UUIDs. Derive a stable, non-reversible UUID so the
// ledger keeps one identifier format and never stores the raw agent ID.
export function subagentThreadId(sessionId, agentId) {
  const hex = createHash('sha256').update(sessionId + ':' + agentId.toLowerCase()).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), '8' + hex.slice(13, 16), 'a' + hex.slice(17, 20), hex.slice(20, 32)].join('-');
}

// Layout: <projects>/<project>/<sessionId>.jsonl
//         <projects>/<project>/<sessionId>/subagents/agent-<agentId>.jsonl
function classifyTranscript(directory, name) {
  const session = name.endsWith('.jsonl') ? uuid(name.slice(0, -'.jsonl'.length)) : null;
  if (session) return { id: session, sessionId: session, parent: null };
  const agent = agentFilePattern.exec(name);
  const parentSession = uuid(dirname(directory).split(/[\\/]/).at(-1));
  if (agent && directory.split(/[\\/]/).at(-1) === 'subagents' && parentSession) {
    return { id: subagentThreadId(parentSession, agent[1]), sessionId: parentSession, parent: parentSession };
  }
  return null;
}

async function discoverSessions(dir, coverage) {
  const sessions = new Map();
  let root;
  try {
    if (!(await lstat(dir)).isDirectory()) {
      coverage.discovery_errors++;
      return { sessions };
    }
    root = await realpath(dir);
  } catch (error) {
    if (error.code !== 'ENOENT') coverage.discovery_errors++;
    return { sessions };
  }
  coverage.transcript_directory_found = true;

  const remaining = [root];
  while (remaining.length) {
    const directory = remaining.pop();
    let entries;
    try {
      if (!(await lstat(directory)).isDirectory() || !isWithin(await realpath(directory), root)) {
        coverage.discovery_errors++;
        continue;
      }
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      coverage.discovery_errors++;
      continue;
    }
    entries.sort((a, b) => a.name < b.name ? -1 : Number(a.name !== b.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) remaining.push(path);
      if (!entry.isFile()) continue;
      const transcript = classifyTranscript(directory, entry.name);
      if (!transcript) continue;
      const files = sessions.get(transcript.id) ?? [];
      files.push({ path, parent: transcript.parent, sessionId: transcript.sessionId });
      sessions.set(transcript.id, files);
    }
  }
  return { root, sessions };
}

function familyOf(sessions, rootThreadId, coverage) {
  if (!sessions.has(rootThreadId)) return [];
  const children = new Map();
  for (const [id, files] of sessions) {
    const parents = new Set(files.map(file => file.parent));
    if (parents.size !== 1) {
      coverage.ambiguous_thread_links++;
      if (id !== rootThreadId) continue;
    }
    const [parent] = parents;
    const siblings = children.get(parent) ?? [];
    siblings.push(id);
    children.set(parent, siblings);
  }

  const family = [{ id: rootThreadId, parent: null, files: sessions.get(rootThreadId) }];
  const seen = new Set([rootThreadId]);
  for (const { id } of family) {
    for (const child of (children.get(id) ?? []).sort()) {
      if (seen.has(child)) continue;
      seen.add(child);
      family.push({ id: child, parent: id, files: sessions.get(child) });
    }
  }
  return family;
}

function tokenNumber(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// Anthropic usage reports uncached input separately from cache reads and writes.
// Normalize to the ledger convention, where input_tokens includes both cached subsets.
function normalizeUsage(usage) {
  const base = tokenNumber(usage.input_tokens);
  const write = tokenNumber(usage.cache_creation_input_tokens);
  const read = tokenNumber(usage.cache_read_input_tokens);
  const output = tokenNumber(usage.output_tokens);
  const thinking = tokenNumber(usage.output_tokens_details?.thinking_tokens);
  const input = base !== null && write !== null && read !== null ? base + write + read : null;
  return {
    input_tokens: input,
    cached_input_tokens: input !== null ? read : null,
    cache_write_input_tokens: input !== null ? write : null,
    output_tokens: output,
    reasoning_output_tokens: output !== null && thinking !== null && thinking <= output ? thinking : null,
    total_tokens: input !== null && output !== null ? input + output : null,
    uncached_input_tokens: input !== null ? input - read : null,
  };
}

function scopeIncludes(date, rootTurn, scope) {
  return date >= scope.start && date < scope.end && (scope.turnId === undefined || rootTurn === scope.turnId);
}

async function scanThread(thread, transcriptRoot, scope, coverage) {
  const responses = new Map();
  let relevant = false;
  let malformed = false;
  for (const { path, sessionId } of thread.files) {
    let input;
    let lines;
    try {
      input = (await openTranscript(path, transcriptRoot)).createReadStream();
      lines = createInterface({ input, crlfDelay: Infinity });
      // Assistant records carry no prompt ID; attribute them to the latest user prompt in file order.
      let prompt = null;
      for await (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line.replace(/^﻿/, ''));
        } catch {
          coverage.malformed_json_lines++;
          malformed = true;
          continue;
        }
        if (entry?.type === 'user') {
          prompt = uuid(entry.promptId) ?? prompt;
          relevant ||= scopeIncludes(timestamp(entry.timestamp), prompt, scope);
          continue;
        }
        if (entry?.type !== 'assistant') continue;
        const message = entry.message;
        // Claude Code writes local synthetic messages (API errors, interrupts) that were never billed.
        if (message?.model === '<synthetic>') {
          coverage.synthetic_records_skipped++;
          continue;
        }

        const date = timestamp(entry.timestamp);
        if (!Number.isFinite(date)) {
          coverage.invalid_response_records++;
          malformed = true;
          continue;
        }
        if (date >= scope.end) continue;
        if (scope.turnId !== undefined && prompt === null && date >= scope.start) {
          coverage.records_missing_root_turn++;
        }
        const inScope = scopeIncludes(date, prompt, scope);
        relevant ||= inScope;
        const responseId = entry.requestId ?? message?.id;
        const usage = message?.usage;
        if (uuid(entry.sessionId) !== sessionId || typeof responseId !== 'string' || !responsePattern.test(responseId)
          || !usage || typeof usage !== 'object' || Array.isArray(usage)) {
          if (inScope) coverage.invalid_response_records++;
          continue;
        }
        const response = {
          date,
          rootTurn: prompt,
          model: typeof message.model === 'string' && namePattern.test(message.model) ? message.model : null,
          effort: efforts.has(entry.effort) ? entry.effort : null,
          totals: normalizeUsage(usage),
        };
        // One API response is written as several lines (one per content block) with identical usage.
        const previous = responses.get(responseId);
        if (!previous) {
          responses.set(responseId, { response, duplicates: 0, conflicted: false });
          continue;
        }
        previous.duplicates++;
        previous.conflicted ||= response.rootTurn !== previous.response.rootTurn
          || fields.some(field => response.totals[field] !== previous.response.totals[field]);
        if (date < previous.response.date) previous.response = response;
      }
    } catch {
      coverage.unreadable_selected_transcripts++;
      malformed = true;
    } finally {
      lines?.close();
      input?.destroy();
    }
  }

  const observed = [];
  for (const { response, duplicates, conflicted } of responses.values()) {
    if (!scopeIncludes(response.date, response.rootTurn, scope)) continue;
    coverage.duplicate_response_records += duplicates;
    if (conflicted) coverage.conflicting_response_ids++;
    else observed.push(response);
  }
  return { relevant: relevant || malformed, observed };
}

function aggregate(responses) {
  const totals = Object.fromEntries(fields.map(field => [field, responses.length ? 0 : null]));
  for (const response of responses) {
    for (const field of fields) {
      const value = response.totals[field];
      totals[field] = totals[field] === null || value === null ? null : tokenNumber(totals[field] + value);
    }
  }
  return { response_count: responses.length, totals };
}

export async function collectUsage({ transcriptDir = defaultTranscriptDir(), rootThreadId,
  since, until = new Date().toISOString(), turnId } = {}) {
  const rootId = uuid(rootThreadId);
  if (rootId === null) throw new Error('A valid root session UUID is required.');
  const normalizedTurnId = turnId === undefined ? undefined : uuid(turnId);
  if (normalizedTurnId === null) throw new Error('The prompt filter must be a valid UUID.');
  const scope = { start: timestamp(since), end: timestamp(until), turnId: normalizedTurnId };
  if (!Number.isFinite(scope.start) || !Number.isFinite(scope.end) || scope.start >= scope.end) {
    throw new Error('Supply ISO 8601 timestamps with explicit time zones and an end after the start.');
  }
  if (typeof transcriptDir !== 'string' || transcriptDir.length === 0) throw new Error('A transcript directory is required.');

  const coverage = {
    source: usageSource,
    status: 'unavailable',
    transcript_directory_found: false,
    root_thread_found: false,
    discovery_errors: 0,
    ambiguous_thread_links: 0,
    unreadable_selected_transcripts: 0,
    malformed_json_lines: 0,
    invalid_response_records: 0,
    records_missing_root_turn: 0,
    duplicate_response_records: 0,
    conflicting_response_ids: 0,
    synthetic_records_skipped: 0,
    threads_without_usage: 0,
    unknown_model_responses: 0,
    unknown_effort_responses: 0,
    missing_fields: Object.fromEntries(fields.map(field => [field, 0])),
    note: coverageNote,
  };
  const { root, sessions } = await discoverSessions(resolve(transcriptDir), coverage);
  const family = familyOf(sessions, rootId, coverage);
  coverage.root_thread_found = family.length > 0;
  const byThread = [];
  const byModel = new Map();
  const allResponses = [];
  for (const thread of family) {
    const { relevant, observed } = await scanThread(thread, root, scope, coverage);
    if (!relevant && thread.id !== rootId) continue;
    byThread.push({ thread_id: thread.id, parent_thread_id: thread.parent, ...aggregate(observed) });
    if (!observed.length) coverage.threads_without_usage++;
    for (const response of observed) {
      allResponses.push(response);
      const { model, effort, totals } = response;
      if (model === null) coverage.unknown_model_responses++;
      if (effort === null) coverage.unknown_effort_responses++;
      for (const field of fields) {
        if (totals[field] === null) coverage.missing_fields[field]++;
      }
      const key = JSON.stringify([model, effort]);
      const group = byModel.get(key) ?? { model, effort, responses: [] };
      group.responses.push(response);
      byModel.set(key, group);
    }
  }

  const overall = aggregate(allResponses);
  const incomplete = [
    coverage.discovery_errors, coverage.ambiguous_thread_links,
    coverage.unreadable_selected_transcripts, coverage.malformed_json_lines, coverage.invalid_response_records,
    coverage.records_missing_root_turn, coverage.conflicting_response_ids,
    coverage.threads_without_usage, coverage.unknown_model_responses, coverage.unknown_effort_responses,
    ...Object.values(coverage.missing_fields),
  ].some(Boolean) || fields.some(field => overall.totals[field] === null);
  const hasTokenCounts = allResponses.some(response => fields.some(field => response.totals[field] !== null));
  if (hasTokenCounts) coverage.status = incomplete ? 'partial' : 'observed';
  return {
    schema_version: 1,
    root_thread_id: rootId,
    root_turn_id: normalizedTurnId ?? null,
    window: { start: new Date(scope.start).toISOString(), end: new Date(scope.end).toISOString() },
    ...overall,
    by_thread: byThread,
    by_model: [...byModel.keys()].sort().map(key => {
      const { model, effort, responses } = byModel.get(key);
      return { model, effort, ...aggregate(responses) };
    }),
    coverage,
  };
}

export function renderMarkdown(report) {
  const count = value => value ?? 'Unavailable';
  const columns = '| Responses | Input | Cached input | Cache write input | Uncached input | Output | Reasoning output | Total |';
  const separators = '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
  const row = ({ response_count, totals }) => [
    response_count, totals.input_tokens, totals.cached_input_tokens, totals.cache_write_input_tokens,
    totals.uncached_input_tokens, totals.output_tokens, totals.reasoning_output_tokens, totals.total_tokens,
  ].map(count).join(' | ') + ' |';
  const coverage = report.coverage;
  const warnings = [
    !coverage.transcript_directory_found && '- Local Claude Code transcript directory was unavailable.',
    !coverage.root_thread_found && '- Root session transcript was unavailable.',
    (coverage.discovery_errors || coverage.ambiguous_thread_links)
      && '- Some transcripts or subagent lineage could not be verified.',
    coverage.unreadable_selected_transcripts && '- Some selected transcripts could not be read.',
    (coverage.malformed_json_lines || coverage.invalid_response_records || coverage.conflicting_response_ids)
      && '- Some malformed or conflicting records were skipped.',
    coverage.records_missing_root_turn && '- Some records could not be assigned to the selected root prompt.',
    coverage.threads_without_usage && '- Some selected sessions or subagents had no response usage records in this window.',
    (coverage.unknown_model_responses || coverage.unknown_effort_responses)
      && '- Some responses lacked model or effort attribution.',
    Object.values(coverage.missing_fields).some(Boolean) && '- Some token fields were unavailable in the response records.',
  ].filter(Boolean);
  return [
    '# Claude Code workflow token usage', '', 'Root session · ' + report.root_thread_id,
    ...(report.root_turn_id ? ['Root prompt · ' + report.root_turn_id] : []),
    'Window (start inclusive, end exclusive) · ' + report.window.start + ' to ' + report.window.end,
    'Telemetry coverage · ' + coverage.status, '', coverage.note,
    'Input includes cache reads (cached input) and cache writes; reasoning output (thinking) is included in output.', '',
    ...warnings, ...(warnings.length ? [''] : []),
    '## Workflow totals', '', columns, separators, '| ' + row(report), '',
    '## By session and subagent', '', '| Thread | Parent ' + columns, '| --- | --- ' + separators,
    ...report.by_thread.map(thread => '| ' + thread.thread_id + ' | ' + (thread.parent_thread_id ?? 'Root') + ' | ' + row(thread)), '',
    '## By recorded model and effort', '', '| Model | Effort ' + columns, '| --- | --- ' + separators,
    ...report.by_model.map(group => '| ' + (group.model ?? 'Unknown') + ' | ' + (group.effort ?? 'Unknown') + ' | ' + row(group)), '',
  ].join('\n');
}

export async function writeReport(path, content) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, '.workflow-usage-' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  let args;
  try {
    args = parseArgs({ options: {
      session: { type: 'string' }, since: { type: 'string' }, until: { type: 'string' }, prompt: { type: 'string' },
      'transcript-dir': { type: 'string' }, output: { type: 'string' }, markdown: { type: 'string' },
    } }).values;
  } catch {
    throw new Error('Invalid command options.');
  }
  if (!args.output) throw new Error('The --output JSON path is required.');
  const output = resolve(args.output);
  const markdown = args.markdown ? resolve(args.markdown) : null;
  const pathKey = path => process.platform === 'win32' ? path.toLowerCase() : path;
  if (markdown && pathKey(markdown) === pathKey(output)) {
    throw new Error('Use different paths for the JSON and Markdown reports.');
  }
  const report = await collectUsage({
    transcriptDir: args['transcript-dir'], rootThreadId: args.session, since: args.since, until: args.until, turnId: args.prompt,
  });
  try {
    await writeReport(output, JSON.stringify(report, null, 2) + '\n');
    if (markdown) await writeReport(markdown, renderMarkdown(report));
  } catch {
    throw new Error('Could not write the requested report files.');
  }
  console.log('Workflow usage: ' + report.coverage.status + ' · ' + report.response_count
    + ' responses · ' + (report.totals.total_tokens ?? 'unavailable') + ' total tokens');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Workflow usage: ' + error.message);
    process.exitCode = 1;
  });
}
