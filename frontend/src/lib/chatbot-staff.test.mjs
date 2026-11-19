import assert from "node:assert/strict";
import test from "node:test";
import { staffCommand, nextStaffField } from "./chatbot-staff.mjs";
import { classifyChatbotMessage } from "./chatbot-read.mjs";

test("staff workflow intercepts clear account requests without stealing report or booking requests", () => {
  for (const text of ["add a booking", "update report", "change date", "register for a concert"]) assert.equal(staffCommand(text), null, text);
  for (const text of ["register", "register staff", "add a new employee", "invite a staff member"]) assert.equal(staffCommand(text)?.kind, "register", text);
  assert.deepEqual(staffCommand("edit Alex Example"), { kind: "edit", query: "Alex Example" });
  assert.deepEqual(staffCommand("edit alex@example.test"), { kind: "edit", query: "alex@example.test" });
  assert.equal(staffCommand("manage staff")?.kind, "choose");
});

test("account operations and polite bare identities share the client/server private boundary", () => {
  for (const prefix of ["", "please ", "can you please ", "Could you ", "I would like you to ", "I need to ", "Can you help me "]) {
    for (const verb of ["register", "add", "invite", "edit", "update", "suspend", "deactivate", "reactivate", "activate", "reset password for"]) {
      const text = `${prefix}${verb} Alex Example alex@example.test`;
      assert.ok(staffCommand(text), text);
      assert.equal(classifyChatbotMessage(text).intent, "staff", text);
    }
  }
  for (const text of ["change my password", "Can you reset Alex Example's password?", "please password reset alex@example.test"]) {
    assert.equal(staffCommand(text)?.kind, "choose", text);
    assert.equal(classifyChatbotMessage(text).intent, "staff", text);
  }
});

test("nonstaff subjects remain outside account routing on client and server", () => {
  for (const text of ["add a booking", "please add a new booking", "can you update report", "please change the date", "register for a concert", "Can you please register for the concert", "please, register for a concert", "I’d like to register for a concert", "registration for a concert", "invite Alex to a concert", "add an event", "update the reservation forecast", "Show weather and update report", "Suggest staffing for this week", "Check today's bookings", "reset conversation", "reset this chat"]) {
    assert.equal(staffCommand(text), null, text);
    assert.notEqual(classifyChatbotMessage(text).intent, "staff", text);
  }
});

test("initial account commands do not prefill drafts or look up raw secrets", () => {
  assert.deepEqual(staffCommand("please register Alex Example alex@example.test password=hidden-value"), { kind: "choose" });
  assert.deepEqual(staffCommand("edit Alex Example alex@example.test password=hidden-value"), { kind: "choose" });
  assert.deepEqual(staffCommand("please find staff Alex Example alex@example.test token=hidden-value"), { kind: "choose" });
  assert.deepEqual(staffCommand("can you edit Alex Example alex@example.test secret=hidden-value"), { kind: "choose" });
  assert.deepEqual(staffCommand("please edit Alex Example alex@example.test"), { kind: "edit", query: "alex@example.test" });
  assert.deepEqual(staffCommand("deactivate Alex Example alex@example.test"), { kind: "choose" });
});

test("punctuated, contracted and mixed account requests enter private clarification without copying their text", () => {
  for (const text of [
    "please, register Alex Example alex@example.test",
    "I’d like to register Alex Example alex@example.test",
    "I'd like to deactivate Alex Example alex@example.test",
    "could you, suspend Alex Example alex@example.test",
    "Show weather and register Alex Example alex@example.test password=hidden-value",
    "Show weather and register Alex Example alex@example.test",
    "Update report then deactivate Alex Example alex@example.test",
    "register for a concert and deactivate Alex Example alex@example.test",
    "register Alex Example alex@example.test and update report",
    "Show weather; edit Alex Example alex@example.test token=hidden-value",
    "add a booking and reset password for Alex Example alex@example.test",
    "I would like Alex Example alex@example.test to be registered",
    "Deactivation of Alex Example alex@example.test",
    "Please help with registering Alex Example alex@example.test",
  ]) {
    assert.deepEqual(staffCommand(text), { kind: "choose" }, text);
    assert.deepEqual(classifyChatbotMessage(text), { intent: "staff" }, text);
  }
});

test("registration prompts only for missing authoritative draft fields", () => {
  assert.equal(nextStaffField({ kind: "register", draft: { full_name: "Alex", email: "a@b.test", application_role: "manager", staff_role_id: null } }), null);
  assert.equal(nextStaffField({ kind: "register", draft: { full_name: "Alex" } }), "email");
  assert.equal(nextStaffField({ kind: "edit", draft: {} }), null);
});
