import assert from "node:assert/strict";
import test from "node:test";
import {
  dismissOnboardingPrompt,
  isOnboardingComplete,
  isOnboardingPromptDismissed,
  loadOnboardingProgress,
  markOnboardingComplete,
  resetOnboardingState,
  resolveOnboardingResumeStep,
  saveOnboardingProgress,
} from "./onboarding-progress";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const storage = new MemoryStorage();
Object.assign(globalThis, { localStorage: storage });

test.beforeEach(() => storage.clear());

test("keeps progress isolated per user and rejects malformed steps", () => {
  saveOnboardingProgress("alice", "love");
  saveOnboardingProgress("bob", "drivers");

  assert.equal(loadOnboardingProgress("alice")?.step, "love");
  assert.equal(loadOnboardingProgress("bob")?.step, "drivers");
  assert.equal(loadOnboardingProgress("carol"), null);

  storage.setItem("consumed_onboarding_progress:alice", JSON.stringify({ step: "not-a-step" }));
  assert.equal(loadOnboardingProgress("alice"), null);
});

test("skipping saves progress without marking onboarding complete", () => {
  markOnboardingComplete("alice");
  saveOnboardingProgress("alice", "drivers");

  assert.equal(isOnboardingComplete("alice"), false);
  assert.equal(loadOnboardingProgress("alice")?.step, "drivers");
});

test("completed retakes preserve completion while saving an editable step", () => {
  markOnboardingComplete("alice");
  saveOnboardingProgress("alice", "love", { preserveCompletion: true });

  assert.equal(isOnboardingComplete("alice"), true);
  assert.equal(loadOnboardingProgress("alice")?.step, "love");
});

test("first-time setup cannot skip title selection because of a retake URL or missing draft", () => {
  const firstTimeState = {
    hasExistingProfile: false,
    resumeDNA: true,
    resumeRequested: true,
    isNewAccount: true,
    hasFormats: true,
    hasGenres: true,
    hasLoveResponse: false,
    hasDriverResponse: false,
  };

  assert.equal(
    resolveOnboardingResumeStep({ ...firstTimeState, draftStep: "interests" }),
    "loved",
  );
  assert.equal(
    resolveOnboardingResumeStep({ ...firstTimeState, draftStep: null }),
    "loved",
  );
});

test("only an existing DNA profile gets the retake shortcut", () => {
  assert.equal(resolveOnboardingResumeStep({
    hasExistingProfile: true,
    resumeDNA: true,
    resumeRequested: true,
    isNewAccount: false,
    draftStep: null,
    hasFormats: true,
    hasGenres: true,
    hasLoveResponse: true,
    hasDriverResponse: true,
  }), "love");
});

test("completion clears progress and prompt dismissal", () => {
  saveOnboardingProgress("alice", "drivers");
  dismissOnboardingPrompt("alice");
  assert.equal(isOnboardingPromptDismissed("alice"), true);

  markOnboardingComplete("alice");
  assert.equal(loadOnboardingProgress("alice"), null);
  assert.equal(isOnboardingPromptDismissed("alice"), false);
});

test("reset removes all state for one user without affecting another", () => {
  markOnboardingComplete("alice");
  saveOnboardingProgress("bob", "interests");
  resetOnboardingState("alice");

  assert.equal(isOnboardingComplete("alice"), false);
  assert.equal(loadOnboardingProgress("bob")?.step, "interests");
});