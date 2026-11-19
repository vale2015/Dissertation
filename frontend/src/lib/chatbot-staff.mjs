const POLITE_PREFIX = /^(?:(?:please|kindly)\s+|(?:can|could|would|will)\s+you\s+|help\s+me\s+(?:to\s+)?|i\s+(?:(?:want|need)\s+(?:you\s+)?to|would\s+like\s+(?:you\s+)?to)\s+)/i;
const NON_STAFF_SUBJECT = /^(?:(?:a|an|the|my|new|another|this|that|current)\s+)*(?:reports?|dates?|calendar|bookings?|reservations?|weather|events?|forecasts?|concerts?|sports|meetings?|tickets?|chat|conversation)\b/i;
const CREDENTIAL_TEXT = /\b(password|passphrase|token|secret|authorization|bearer|api[_ -]?key)\b/i;
const ACCOUNT_OPERATIONS = /\b(register(?:s|ed|ing)?|registration|add(?:s|ed|ing)?|invit(?:e[ds]?|ing|ation)|edit(?:s|ed|ing)?|updat(?:e[ds]?|ing)|chang(?:e[ds]?|ing)|suspend(?:s|ed|ing)?|deactivat(?:e[ds]?|ing|ion)|reactivat(?:e[ds]?|ing|ion)|activat(?:e[ds]?|ing|ion)|reset(?:s|ting)?)\b/gi;
const DIRECT_OPERATION = /^(register|add|invite|edit|update|change|suspend|deactivate|reactivate|activate)\b\s*(.*)$/i;

function nonStaffSubject(subject) {
  const clause = subject.split(/\b(?:and|also|then|but)\b|[;!?]/i)[0].trim();
  return NON_STAFF_SUBJECT.test(clause)
    || NON_STAFF_SUBJECT.test(clause.replace(/^(?:for|to|at|with)\s+/i, ""))
    || /\b(?:to|for)\s+(?:(?:a|the)\s+)?(?:concert|event|meeting)\b/i.test(clause);
}

function requiresPrivateClarification(value) {
  // This is a privacy boundary, not a natural-language execution engine.
  // Credential-bearing and mixed/unparsed account operations must never fall
  // through to the general transcript, provider, or an inferred draft/query.
  if (CREDENTIAL_TEXT.test(value)) return true;
  const operations = [...value.matchAll(ACCOUNT_OPERATIONS)];
  const accountOperations = operations.filter((operation, index) => {
    const end = operations[index + 1]?.index ?? value.length;
    return !nonStaffSubject(value.slice(operation.index + operation[0].length, end));
  });
  return accountOperations.length > 0
    && (operations.length > 1 || accountOperations[0].index !== 0 || !DIRECT_OPERATION.test(value) || /\b(and|also|then|but)\b/i.test(value));
}

function identityQuery(value) {
  const query = value.trim().replace(/\s+please[.!?]?$/i, "");
  // An initial command never imports credentials into a lookup or draft.
  if (CREDENTIAL_TEXT.test(query) || /https?:\/\//i.test(query)) return "";
  const emails = query.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
  if (emails?.length === 1 && emails[0].length <= 80) return emails[0];
  return /^[\p{L}\p{M} .'-]{2,80}$/u.test(query) ? query : "";
}

// Shared by the client privacy boundary and server intent routing. Commands
// select a protected workflow; they never execute an account mutation.
export function staffCommand(text) {
  let value = typeof text === "string" ? text.trim() : "";
  while (POLITE_PREFIX.test(value)) value = value.replace(POLITE_PREFIX, "").trim();
  if (!value) return null;
  if (requiresPrivateClarification(value)) return { kind: "choose" };
  if (/^(?:(?:manage|show|open)\s+)?staff(?:\s+management)?[.!?]?$/i.test(value)) return { kind: "choose" };

  const search = /^(?:find|show|search(?: for)?|look up)\s+(?:staff|employee|team member)\s+(.+)$/i.exec(value);
  if (search) return { kind: "edit", query: identityQuery(search[1]) };

  if (/^(?:reset|change|update)\b.*\bpassword\b|^password\s+reset\b/i.test(value)) return { kind: "choose" };
  const operation = DIRECT_OPERATION.exec(value);
  if (operation) {
    const [, verb, subject] = operation;
    if (nonStaffSubject(subject)) return null;
    if (/^(register|add|invite)$/i.test(verb)) return { kind: "register" };
    if (/^(edit|update|change)$/i.test(verb)) return { kind: "edit", query: identityQuery(subject.replace(/^(?:staff|employee)(?:\s+member)?\s*/i, "")) };
    return { kind: "choose" };
  }
  if (/\b(staff|employee|employees|team members?|password reset|reset password)\b/i.test(value) && !/\b(forecast|suggest|recommend|required|need)\b/i.test(value)) return { kind: "choose" };
  return null;
}

export const STAFF_FIELDS = { full_name: "Full name", email: "Email", application_role: "Application access", staff_role_id: "Restaurant role" };
export function nextStaffField(action) {
  if (action.kind !== "register") return null;
  return Object.keys(STAFF_FIELDS).find((key) => !Object.hasOwn(action.draft || {}, key) || (key !== "staff_role_id" && !action.draft[key])) || null;
}
