import test from "node:test";
import assert from "node:assert/strict";
import { formatDnaGreeting, resolveFirstName } from "./feed-identity-name";

test("canonical profile first name wins over auth metadata", () => {
  assert.equal(
    resolveFirstName(" Heidi ", { first_name: "Metadata", firstName: "Other" }),
    "Heidi",
  );
});

test("metadata first_name and firstName are supported as fallbacks", () => {
  assert.equal(resolveFirstName(null, { first_name: "  Heidi " }), "Heidi");
  assert.equal(resolveFirstName(null, { firstName: "Heidi" }), "Heidi");
});

test("non-name account metadata is never used as a first name", () => {
  assert.equal(
    resolveFirstName(undefined, {
      display_name: "Heidi Smith",
      username: "heidi123",
      email: "heidi@example.com",
    }),
    "",
  );
});

test("DNA greeting is uppercase and remains graceful when unnamed", () => {
  assert.equal(formatDnaGreeting("Heidi"), "HEIDI, YOU’RE");
  assert.equal(formatDnaGreeting(""), "YOU’RE");
});
