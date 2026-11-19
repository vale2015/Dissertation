export function staffCommand(text) {
  const value = text.trim();
  if (/^(?:(?:manage|show|open)\s+)?staff(?:\s+management)?[.!]?$/i.test(value)) return { kind: "choose" };
  const search = /^(?:find|show|search(?: for)?|look up)\s+(?:staff|employee|team member)\s+(.{1,80})$/i.exec(value);
  if (search) return { kind: "edit", query: search[1].trim() };
  if (/^register[.!]?$/i.test(value) || /^(?:register|add|invite)\s+(?:(?:a|an|new)\s+)*(?:staff(?:\s+member)?|employee|account)\b/i.test(value)) return { kind: "register" };
  if (/^(?:edit|update|change)\s+(?:a\s+|the\s+|my\s+)?(?:reports?|date|calendar|bookings?|reservations?|weather|events?|forecast|password)\b/i.test(value)) return null;
  const edit = /^(?:edit|update|change)\s+(?:(?:staff|employee)(?:\s+member)?\s*)?(.*)$/i.exec(value);
  if (edit) return { kind: "edit", query: edit[1].trim() };
  if (/\b(staff|employee|employees|team members?|password reset|reset password)\b/i.test(value) && !/\b(forecast|suggest|recommend|required|need)\b/i.test(value)) return { kind: "choose" };
  return null;
}

export const STAFF_FIELDS = { full_name: "Full name", email: "Email", application_role: "Application access", staff_role_id: "Restaurant role" };
export function nextStaffField(action) {
  if (action.kind !== "register") return null;
  return Object.keys(STAFF_FIELDS).find((key) => !Object.hasOwn(action.draft || {}, key) || (key !== "staff_role_id" && !action.draft[key])) || null;
}
