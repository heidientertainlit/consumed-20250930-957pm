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
import {
  getIdentityProvider,
  getProfileIdentityDefaults,
  hasCompleteProfileIdentity,
  hasConfirmedProfileIdentity,
  isCorrectableProfileCompletionStatus,
  normalizeUsername,
} from "./profile-identity";
import {
  ProfileCompletionError,
  resolveKnownProfileIdentity,
} from "./profile-identity-resolution";

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

test("profile identity distinguishes canonical completeness from confirmation", () => {
  assert.equal(normalizeUsername("  @Heidi_33 "), "heidi_33");
  assert.equal(hasConfirmedProfileIdentity({ identity_confirmed_at: "2026-08-25T22:30:00Z" }), true);
  assert.equal(hasConfirmedProfileIdentity({ identity_confirmed_at: null }), false);
  assert.equal(hasCompleteProfileIdentity({
    first_name: "Heidi",
    last_name: "N",
    user_name: "Heidi_33",
  }), true);
  assert.equal(hasCompleteProfileIdentity({
    first_name: "Heidi",
    last_name: "",
    user_name: "heidi_33",
  }), false);
});

test("email metadata can restore verified signup identity without a second form", () => {
  const user = {
    email: "heidi@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {
      first_name: "Heidi",
      last_name: "Nelson",
      user_name: "heidi_33",
    },
  };
  assert.equal(getIdentityProvider(user), "email");
  assert.deepEqual(getProfileIdentityDefaults(user, null), {
    firstName: "Heidi",
    lastName: "Nelson",
    username: "heidi_33",
    hasCanonicalUsername: false,
    hasMetadataUsername: true,
    missingFirstName: false,
    missingLastName: false,
    missingUsername: true,
  });
});

test("Google and Apple accounts still need an app username", () => {
  const google = {
    email: "person@gmail.com",
    app_metadata: { provider: "google" },
    user_metadata: { full_name: "Taylor Swift" },
  };
  const apple = {
    email: "relay@privaterelay.appleid.com",
    identities: [{ provider: "apple" }],
    user_metadata: {},
  };

  assert.equal(getIdentityProvider(google), "google");
  assert.deepEqual(getProfileIdentityDefaults(google, null), {
    firstName: "Taylor",
    lastName: "Swift",
    username: "person",
    hasCanonicalUsername: false,
    hasMetadataUsername: false,
    missingFirstName: false,
    missingLastName: false,
    missingUsername: true,
  });
  assert.equal(getIdentityProvider(apple), "apple");
  assert.equal(getProfileIdentityDefaults(apple, null).missingFirstName, true);
  assert.equal(getProfileIdentityDefaults(apple, null).missingLastName, true);
  assert.equal(getProfileIdentityDefaults(apple, null).missingUsername, true);
});

test("correctable profile completion responses are distinguished from outages", () => {
  assert.equal(isCorrectableProfileCompletionStatus(400), true);
  assert.equal(isCorrectableProfileCompletionStatus(409), true);
  assert.equal(isCorrectableProfileCompletionStatus(422), true);
  assert.equal(isCorrectableProfileCompletionStatus(500), false);
  assert.equal(isCorrectableProfileCompletionStatus(503), false);
});

test("duplicate email signup username reaches editable onboarding after login", async () => {
  const user = {
    email: "new@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {
      first_name: "New",
      last_name: "Person",
      user_name: "already_taken",
    },
  };
  const attemptedBodies: Record<string, unknown>[] = [];
  const result = await resolveKnownProfileIdentity(
    user,
    null,
    async (body) => {
      attemptedBodies.push(body);
      throw new ProfileCompletionError("That username is already taken.", 409);
    },
  );

  assert.deepEqual(attemptedBodies, [{
    first_name: "New",
    last_name: "Person",
    username: "already_taken",
  }]);
  assert.equal(result.complete, false);
  assert.equal(result.defaults.firstName, "New");
  assert.equal(result.defaults.lastName, "Person");
  assert.equal(result.defaults.username, "already_taken");
  assert.equal(result.defaults.missingUsername, true);
});

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
    draftStep: null,
    hasFormats: true,
    hasGenres: true,
    hasLoveResponse: true,
    hasDriverResponse: true,
  }), "love");
});

test("an incomplete account with no canonical progress starts at the beginning regardless of age", () => {
  assert.equal(resolveOnboardingResumeStep({
    hasExistingProfile: false,
    resumeDNA: false,
    draftStep: null,
    hasFormats: false,
    hasGenres: false,
    hasLoveResponse: false,
    hasDriverResponse: false,
  }), "debate");
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