import assert from "node:assert/strict";
import test from "node:test";
import { staffCommand, nextStaffField } from "./chatbot-staff.mjs";

test("staff workflow intercepts clear account requests without stealing report or booking requests", () => {
  for (const text of ["add a booking", "update report", "change date", "change my password", "register for a concert"]) assert.equal(staffCommand(text), null, text);
  for (const text of ["register", "register staff", "add a new employee", "invite a staff member"]) assert.equal(staffCommand(text)?.kind, "register", text);
  assert.deepEqual(staffCommand("edit Alex Example"), { kind: "edit", query: "Alex Example" });
  assert.deepEqual(staffCommand("edit alex@example.test"), { kind: "edit", query: "alex@example.test" });
  assert.equal(staffCommand("manage staff")?.kind, "choose");
});

test("registration prompts only for missing authoritative draft fields", () => {
  assert.equal(nextStaffField({ kind: "register", draft: { full_name: "Alex", email: "a@b.test", application_role: "manager", staff_role_id: null } }), null);
  assert.equal(nextStaffField({ kind: "register", draft: { full_name: "Alex" } }), "email");
  assert.equal(nextStaffField({ kind: "edit", draft: {} }), null);
});
