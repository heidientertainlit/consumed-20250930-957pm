/**
 * Focused rich lifecycle fixture used by validate-posthog-release.mjs.
 *
 * This module intentionally has no runner side effects. The runner supplies
 * the local server captures and the actual wrapper bundle; this file owns the
 * longer opt-out/identity/replay scenario and its focused assertions so the
 * legacy release harness remains readable.
 */
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

const fakeUserId = "11111111-1111-4111-8111-111111111111";
const accountBId = "22222222-2222-4222-8222-222222222222";

function decodeData(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    try {
      let bytes = Buffer.from(value, "base64");
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      try {
        return JSON.parse(gunzipSync(Buffer.from(value, "latin1")).toString("utf8"));
      } catch {
        return {};
      }
    }
  }
}

function eventName(item) {
  return item?.event || item?.event_name || item?.properties?.event;
}

function itemProperties(item) {
  return item?.properties && typeof item.properties === "object" ? item.properties : {};
}

function itemDistinctId(item) {
  return item?.properties?.distinct_id ?? item?.distinct_id ?? null;
}

function itemSessionId(item) {
  return item?.properties?.$session_id ??
    item?.properties?.session_id ??
    item?.$session_id ??
    null;
}

function policyFields(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return policy;
  return {
    enabled: policy.enabled,
    maskAllInputs: policy.maskAllInputs,
    sampleRate: policy.sampleRate,
    cache_timestamp: policy.cache_timestamp,
  };
}

function snapshotValue(item) {
  return item?.properties?.$snapshot_data ??
    item?.properties?.$snapshot ??
    item?.$snapshot_data ??
    item?.data?.$snapshot_data;
}

function snapshotRecords(items) {
  return items.flatMap((item) => {
    const value = snapshotValue(item);
    let entries;
    if (Array.isArray(value)) entries = value;
    else if (value && typeof value === "object") entries = [value];
    else if (typeof value === "string") {
      const decoded = decodeData(value);
      entries = Array.isArray(decoded)
        ? decoded
        : decoded && typeof decoded === "object" ? [decoded] : [];
    } else {
      entries = [];
    }
    return entries.map((entry) => ({
      entry: entry && typeof entry.data === "string"
        ? { ...entry, data: decodeData(entry.data) }
        : entry,
      distinctId: itemDistinctId(item),
      sessionId: itemSessionId(item),
      phase: item.__fixturePhase,
    }));
  });
}

function richControlScript() {
  return `
  <script src="/assets/posthog-wrapper.js"></script>
  <script>
    (async () => {
      const fixture = window.__posthogReleaseFixture;
      const wrapper = window.PosthogReleaseWrapper;
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const remoteConfig = () => window.posthog.persistence?.props?.$session_recording_remote_config ?? null;
      const state = () => ({
        optedOut: window.posthog.has_opted_out_capturing(),
        capturing: window.posthog.is_capturing(),
        sessionId: window.posthog.get_session_id?.() || null,
        distinctId: window.posthog.get_distinct_id?.() || null,
        recording: window.posthog.sessionRecordingStarted?.() || false,
      });
      const markPhase = async (phase) => {
        fixture.phase = phase;
        await fetch("/fixture-phase?phase=" + encodeURIComponent(phase));
      };
      const accountDom = (account, suffix) => {
        const main = document.querySelector("#fixture-main");
        main.innerHTML =
          "<section id='fixture-" + account + "'>" + account + " " + suffix + "</section>" +
          "<input id='fixture-input' value='" + account + "-input-secret'>" +
          "<div class='ph-no-capture'>" + account + "-private-hook-secret</div>";
      };
      try {
        accountDom("account-a", "initial-dom-secret");
        wrapper.initPostHog();
        await sleep(500);
        fixture.remoteConfigBeforeWrapperOptIn = remoteConfig();
        fixture.originalPolicy = fixture.remoteConfigBeforeWrapperOptIn;
        if (
          fixture.expiredPolicyScenario &&
          fixture.remoteConfigBeforeWrapperOptIn &&
          typeof fixture.remoteConfigBeforeWrapperOptIn === "object"
        ) {
          fixture.expiredPolicy = {
            ...fixture.remoteConfigBeforeWrapperOptIn,
            cache_timestamp: Date.now() - 600_000,
          };
          window.posthog.persistence.register({
            $session_recording_remote_config: fixture.expiredPolicy,
          });
        }
        await markPhase("initial");

        wrapper.setPostHogCaptureAllowed(true, "${fakeUserId}");
        wrapper.identifyUser("${fakeUserId}", {
          email: "fixture@example.test",
          display_name: "Fixture Account A",
        });
        await sleep(500);
        fixture.remoteConfigAfterWrapperOptIn = remoteConfig();
        fixture.initialState = state();
        fixture.initialRecording = fixture.initialState.recording;
        fixture.initialSessionId = fixture.initialState.sessionId;
        wrapper.trackEvent("release_initial", {
          phase: "initial", account: "account-a", normal: true,
        });
        document.querySelector("#fixture-button").click();
        await sleep(3_600);
        window.posthog.flush?.();
        await sleep(400);

        wrapper.setPostHogCaptureAllowed(false);
        await markPhase("optout");
        wrapper.trackEvent("release_optout_blocked", { phase: "optout" });
        window.posthog.capture("sdk_optout_blocked", { phase: "optout" });
        document.querySelector("#fixture-button").click();
        await sleep(250);
        fixture.optoutState = state();

        // The local server holds config request #3 until opt-out is active.
        await sleep(1_500);
        fixture.optoutAfterDelayedConfig = state();
        wrapper.resetUser();
        fixture.remoteConfigAfterReset = remoteConfig();

        await markPhase("recovery");
        wrapper.setPostHogCaptureAllowed(true, "${fakeUserId}");
        await sleep(500);
        fixture.recoveryState = state();
        fixture.beforeRecoveryRecording = fixture.recoveryState.recording;
        fixture.recoverySessionId = fixture.recoveryState.sessionId;
        wrapper.identifyUser("${fakeUserId}", { email: "fixture@example.test" });
        accountDom("account-a", "recovered-dom-secret");
        wrapper.trackEvent("release_recovered", {
          phase: "recovered", account: "account-a", normal: true,
        });
        await sleep(3_600);
        window.posthog.flush?.();
        await sleep(400);

        await markPhase("guest");
        wrapper.resetUser();
        wrapper.setPostHogCaptureAllowed(true, null);
        await sleep(500);
        fixture.guestState = state();
        fixture.guestSessionId = fixture.guestState.sessionId;
        wrapper.trackEvent("release_guest", {
          phase: "guest", identity: "guest", normal: true,
        });
        await sleep(3_600);
        window.posthog.flush?.();
        await sleep(400);

        // An expired policy is held while this guest identity is discarded.
        if (fixture.expiredPolicyScenario) {
          const currentPolicy = remoteConfig();
          if (currentPolicy && typeof currentPolicy === "object") {
            fixture.expiredPolicyForSwitch = {
              ...currentPolicy,
              cache_timestamp: Date.now() - 600_000,
            };
            window.posthog.persistence.register({
              $session_recording_remote_config: fixture.expiredPolicyForSwitch,
            });
          }
        }
        wrapper.setPostHogCaptureAllowed(true, null);
        await sleep(150);
        wrapper.resetUser();
        await markPhase("account-switch-optout");
        await sleep(1_500);
        fixture.afterAccountSwitchDelayedConfig = state();

        await markPhase("account-b");
        accountDom("account-b", "new-account-dom-secret");
        wrapper.setPostHogCaptureAllowed(true, "${accountBId}");
        fixture.accountBReplaySessionId = state().sessionId;
        wrapper.identifyUser("${accountBId}", {
          email: "account-b@example.test",
          display_name: "Fixture Account B",
        });
        await sleep(500);
        fixture.accountBState = state();
        fixture.accountBSessionId = fixture.accountBState.sessionId;
        wrapper.trackEvent("release_account_b", {
          phase: "account-b", account: "account-b", normal: true,
        });
        document.querySelector("#fixture-button").click();
        fixture.directCaptureResult = window.posthog.capture("sdk_account_b_probe", {
          phase: "account-b",
        });
        // Allow the recorder buffer and SDK request batching to drain.
        // Closing earlier can omit the last phase's replay evidence.
        await sleep(7_000);
        window.posthog.flush?.();
        await sleep(500);

        fixture.sdkState = {
          ...state(),
          consent: window.posthog.get_explicit_consent_status?.(),
          sessionRecordingStatus: window.posthog.sessionRecording?.status,
          sessionRecordingConfig: window.posthog.get_property?.("$session_recording_remote_config"),
          persistenceRecordingConfig: window.posthog.persistence?.props?.$session_recording_remote_config,
          persistenceKeys: Object.keys(window.posthog.persistence?.props || {}).filter((key) => key.includes("record")),
          requestQueue: window.posthog._requestQueue?._queue?.length,
          manualRecordingStarts: fixture.manualRecordingStarts,
        };
        fixture.ready = true;
      } catch (error) {
        fixture.errors.push(String(error));
      }
    })();
  </script>`;
}

export function richWrapperControlScript() {
  return richControlScript();
}

export function assertRichLifecycle({
  scenario,
  state,
  fixture,
  events,
  namedEvents,
  captureRecords,
  externalAborted,
  posthogRerouted,
}) {
  const expectedLabels = scenario.native
    ? { surface: "ios_app", platform: "ios" }
    : { surface: "web_app", platform: "web" };
  const configRequests = fixture.requests.filter((request) => request.kind === "remote-config");
  const snapshotItems = captureRecords
    .filter(({ item }) => snapshotValue(item) !== undefined)
    .map(({ item, phase }) => ({ ...item, __fixturePhase: phase }));
  const replayEntries = snapshotRecords(snapshotItems);
  const fullEntries = replayEntries.filter(({ entry }) => entry?.type === 2);
  const snapshotEntries = replayEntries.map(({ entry }) => entry);
  const eventCandidates = events.filter((item) => [
    "release_initial", "release_recovered", "release_guest", "release_account_b",
    "sdk_account_b_probe", "$identify", "$autocapture",
  ].includes(eventName(item)));
  const forbiddenOptoutRecords = captureRecords.filter(({ phase }) =>
    phase === "optout" || phase === "account-switch-optout"
  );
  const fullSnapshotText = (sessionId, distinctId, phase) => fullEntries
    .filter((record) =>
      (phase && record.phase === phase) ||
      (!phase && (
        (sessionId && record.sessionId === sessionId) ||
        (distinctId && record.distinctId === distinctId)
      ))
    )
    .map(({ entry }) => JSON.stringify(entry))
    .join("\n");
  const sessionReplayText = (sessionId, distinctId, phase) => replayEntries
    .filter((record) =>
      (phase && record.phase === phase) ||
      (!phase && (
        (sessionId && record.sessionId === sessionId) ||
        (distinctId && record.distinctId === distinctId)
      ))
    )
    .map(({ entry }) => JSON.stringify(entry))
    .join("\n");
  const initialSnapshotText = fullSnapshotText(state.initialSessionId, fakeUserId, "initial");
  const accountBSnapshotText = sessionReplayText(
    state.accountBReplaySessionId || state.accountBSessionId,
    accountBId,
    "account-b",
  );
  const replayEvidence = {
    configRequests: configRequests.length,
    configDelays: configRequests.map((request) => request.delayMs || 0),
    configResponses: configRequests.map((request) => request.response),
    configPhases: configRequests.map((request) => ({
      phaseAtRequest: request.phaseAtRequest,
      phaseAtResponse: request.phaseAtResponse,
      delayMs: request.delayMs || 0,
    })),
    originalPolicy: policyFields(state.originalPolicy),
    expiredPolicy: policyFields(state.expiredPolicy),
    persistedConfigBeforeWrapperOptIn: state.remoteConfigBeforeWrapperOptIn,
    persistedConfigAfterWrapperOptIn: state.remoteConfigAfterWrapperOptIn,
    persistedConfigAfterReset: state.remoteConfigAfterReset,
    freshPolicyUnchangedAfterOptIn:
      !scenario.expiredPolicy &&
      JSON.stringify(policyFields(state.remoteConfigBeforeWrapperOptIn)) ===
        JSON.stringify(policyFields(state.remoteConfigAfterWrapperOptIn)),
    freshPolicyUnchangedAfterReset:
      !scenario.expiredPolicy &&
      JSON.stringify(policyFields(state.remoteConfigBeforeWrapperOptIn)) ===
        JSON.stringify(policyFields(state.remoteConfigAfterReset)),
    disabledPolicyNotManufactured:
      scenario.recordingDisabled &&
      state.remoteConfigBeforeWrapperOptIn == null &&
      state.remoteConfigAfterWrapperOptIn == null &&
      state.remoteConfigAfterReset == null,
    resetClearedCachedRemoteConfig:
      !!state.remoteConfigBeforeWrapperOptIn && !state.remoteConfigAfterReset,
    recorderResourceLoaded: fixture.requests.some((request) => request.kind === "rrweb-recorder"),
    initialRecording: state.initialRecording,
    recoveryRecording: state.beforeRecoveryRecording,
    guestRecording: state.guestState?.recording,
    accountBRecording: state.accountBState?.recording,
    snapshotItems: snapshotItems.length,
    rrwebEntries: snapshotEntries.length,
    fullSnapshots: fullEntries.length,
    incrementalSnapshots: snapshotEntries.filter((entry) => entry?.type === 3).length,
    initialSessionId: state.initialSessionId,
    recoverySessionId: state.recoverySessionId,
    guestSessionId: state.guestSessionId,
    accountBSessionId: state.accountBSessionId,
    accountBReplaySessionId: state.accountBReplaySessionId,
    initialDistinctId: state.initialState?.distinctId,
    guestDistinctId: state.guestState?.distinctId,
    accountBDistinctId: state.accountBState?.distinctId,
    staleOptoutState: state.optoutAfterDelayedConfig,
    staleAccountSwitchState: state.afterAccountSwitchDelayedConfig,
    forbiddenOptoutRecords: forbiddenOptoutRecords.length,
    manualRecordingStarts: state.sdkState?.manualRecordingStarts,
    reroutedPosthogPaths: posthogRerouted,
    initialSnapshotHasAccountADom: initialSnapshotText.includes("account-a"),
    initialSnapshotMasksInput: !initialSnapshotText.includes("account-a-input-secret"),
    initialSnapshotOmitsPrivateHook: !initialSnapshotText.includes("account-a-private-hook-secret"),
    accountBSnapshotHasNewDom: accountBSnapshotText.includes("account-b"),
    accountBSnapshotOmitsPreviousDom: !accountBSnapshotText.includes("account-a"),
    accountBSnapshotMasksInput: !accountBSnapshotText.includes("account-b-input-secret"),
    accountBSnapshotOmitsPrivateHook: !accountBSnapshotText.includes("account-b-private-hook-secret"),
    requestPaths: fixture.requests.map((request) => request.path),
  };
  const accountBIdentify = events.find((item) =>
    eventName(item) === "$identify" && itemDistinctId(item) === accountBId
  );

  assert.equal(externalAborted.length, 0,
    `${scenario.name}: unexpected external requests ${externalAborted.join(", ")}`);
  assert.ok(posthogRerouted.length,
    `${scenario.name}: no published-host requests were locally intercepted`);
  assert.ok(state.initCalls?.length, `${scenario.name}: initPostHog did not call the SDK`);
  const init = state.initCalls[0];
  assert.equal(init.key, "phc_local_release_regression_only", `${scenario.name}: fake key changed`);
  assert.equal(init.config.api_host, "https://us.i.posthog.com", `${scenario.name}: host changed`);
  assert.equal(init.config.api_transport, "fetch", `${scenario.name}: transport changed`);
  assert.equal(init.config.request_batching, true, `${scenario.name}: batching changed`);
  assert.equal(init.config.autocapture, true, `${scenario.name}: autocapture changed`);
  assert.equal(init.config.capture_pageleave, true, `${scenario.name}: pageleave changed`);
  assert.equal(configRequests[0]?.responseStatus, 200,
    `${scenario.name}: initial local JSON remote config did not load`);

  if (scenario.recordingDisabled) {
    assert.ok(configRequests.length >= 1, `${scenario.name}: disabled config did not load`);
    assert.ok(configRequests.every((request) => request.response?.sessionRecording === false),
      `${scenario.name}: server-disabled recording policy changed`);
    assert.equal(state.sdkState?.recording, false, `${scenario.name}: disabled recording started`);
    for (const phase of ["initialState", "recoveryState", "guestState", "accountBState"]) {
      assert.equal(state[phase]?.recording, false,
        `${scenario.name}: disabled recording started in ${phase}`);
    }
    assert.equal(replayEvidence.recorderResourceLoaded, false,
      `${scenario.name}: disabled recording loaded rrweb`);
    assert.equal(snapshotItems.length, 0,
      `${scenario.name}: disabled recording emitted snapshots`);
    assert.equal(replayEvidence.disabledPolicyNotManufactured, true,
      `${scenario.name}: disabled server policy was manufactured locally`);
  } else {
    assert.deepEqual(configRequests[0]?.response, {
      sessionRecording: { sampleRate: 1, minimumDurationMilliseconds: 0, maskAllInputs: true },
    }, `${scenario.name}: enabled remote config schema changed`);
    assert.ok(configRequests.length >= (scenario.expiredPolicy ? 3 : 1),
      `${scenario.name}: expected local remote configuration requests ${JSON.stringify(replayEvidence)}`);
    if (scenario.expiredPolicy) {
      assert.ok(
        configRequests.some((request) =>
          (request.delayMs || 0) >= 4_000 &&
          request.phaseAtRequest === "initial" &&
          ["optout", "recovery"].includes(request.phaseAtResponse),
        ),
        `${scenario.name}: expired policy response did not cross opt-out ${JSON.stringify(replayEvidence)}`,
      );
      assert.ok(
        configRequests.some((request) =>
          (request.delayMs || 0) >= 4_000 &&
          request.phaseAtRequest === "guest" &&
          ["account-switch-optout", "account-b"].includes(request.phaseAtResponse),
        ),
        `${scenario.name}: expired policy response did not cross account switch ${JSON.stringify(replayEvidence)}`,
      );
      assert.notEqual(
        replayEvidence.originalPolicy?.cache_timestamp,
        replayEvidence.expiredPolicy?.cache_timestamp,
        `${scenario.name}: expired-policy fixture did not preserve the original timestamp before expiry`,
      );
    } else {
      assert.equal(replayEvidence.freshPolicyUnchangedAfterOptIn, true,
        `${scenario.name}: fresh policy changed during opt-in reset`);
      assert.equal(replayEvidence.freshPolicyUnchangedAfterReset, true,
        `${scenario.name}: fresh policy changed during reset`);
    }
    assert.ok(replayEvidence.recorderResourceLoaded,
      `${scenario.name}: local rrweb recorder was not loaded`);
    assert.equal(replayEvidence.initialRecording, true,
      `${scenario.name}: initial replay did not start before recovery`);
    assert.equal(replayEvidence.recoveryRecording, true,
      `${scenario.name}: opt-out -> reset -> opt-in replay did not recover`);
    assert.equal(replayEvidence.guestRecording, true,
      `${scenario.name}: guest replay did not start after logout`);
    assert.equal(replayEvidence.accountBRecording, true,
      `${scenario.name}: different-account replay did not start`);
    assert.ok(replayEvidence.fullSnapshots > 0, `${scenario.name}: no full snapshot`);
    assert.ok(replayEvidence.incrementalSnapshots > 0, `${scenario.name}: no incremental snapshot`);
    assert.equal(replayEvidence.initialSnapshotHasAccountADom, true,
      `${scenario.name}: initial snapshot omitted account A DOM`);
    assert.equal(replayEvidence.initialSnapshotMasksInput, true,
      `${scenario.name}: initial snapshot exposed an input`);
    assert.equal(replayEvidence.initialSnapshotOmitsPrivateHook, true,
      `${scenario.name}: initial snapshot exposed ph-no-capture DOM`);
    assert.equal(replayEvidence.accountBSnapshotHasNewDom, true,
      `${scenario.name}: account B snapshot omitted new-account DOM`);
    assert.equal(replayEvidence.accountBSnapshotOmitsPreviousDom, true,
      `${scenario.name}: account B snapshot retained account A DOM`);
    assert.equal(replayEvidence.accountBSnapshotMasksInput, true,
      `${scenario.name}: account B snapshot exposed an input`);
    assert.equal(replayEvidence.accountBSnapshotOmitsPrivateHook, true,
      `${scenario.name}: account B snapshot exposed ph-no-capture DOM`);
    assert.notEqual(replayEvidence.initialSessionId, replayEvidence.accountBSessionId,
      `${scenario.name}: account A and B reused a replay session`);
    assert.notEqual(replayEvidence.guestSessionId, replayEvidence.accountBSessionId,
      `${scenario.name}: guest and account B reused a replay session`);
    assert.equal(replayEvidence.initialDistinctId, fakeUserId,
      `${scenario.name}: account A identity was not preserved`);
    assert.notEqual(replayEvidence.guestDistinctId, fakeUserId,
      `${scenario.name}: logout retained account A identity`);
    assert.equal(replayEvidence.accountBDistinctId, accountBId,
      `${scenario.name}: account B identity was not established`);
  }

  assert.equal(state.optoutState?.optedOut, true,
    `${scenario.name}: opt-out state was not active`);
  assert.equal(state.optoutState?.capturing, false,
    `${scenario.name}: SDK captured while opted out`);
  for (const [key, label] of [
    ["optoutAfterDelayedConfig", "delayed opt-out"],
    ["afterAccountSwitchDelayedConfig", "delayed account-switch"],
  ]) {
    assert.equal(state[key]?.capturing, false, `${scenario.name}: ${label} re-enabled capture`);
    assert.equal(state[key]?.recording, false, `${scenario.name}: ${label} re-enabled recording`);
  }
  assert.equal(forbiddenOptoutRecords.length, 0,
    `${scenario.name}: events or snapshots were sent in an opt-out phase`);
  assert.equal(state.sdkState?.manualRecordingStarts, 0,
    `${scenario.name}: wrapper manually started recording`);
  for (const item of eventCandidates) {
    const properties = itemProperties(item);
    assert.equal(properties.surface, expectedLabels.surface,
      `${scenario.name}: event surface label was not applied`);
    assert.equal(properties.platform, expectedLabels.platform,
      `${scenario.name}: event platform label was not applied`);
  }
  for (const event of [
    "release_initial", "release_recovered", "release_guest",
    "release_account_b", "sdk_account_b_probe",
  ]) {
    assert.ok(namedEvents.includes(event), `${scenario.name}: normal event ${event} was not emitted`);
  }
  assert.equal(namedEvents.includes("release_optout_blocked"), false,
    `${scenario.name}: wrapper opt-out event escaped`);
  assert.equal(namedEvents.includes("sdk_optout_blocked"), false,
    `${scenario.name}: direct SDK opt-out event escaped`);
  assert.ok(accountBIdentify, `${scenario.name}: account B identify event was not emitted`);

  const result = {
    scenario: scenario.name,
    mode: "actual-wrapper-rich-identity-and-replay",
    requestPaths: fixture.requests.map((request) => request.path),
    events: namedEvents,
    replayRecovered: scenario.recordingDisabled
      ? !replayEvidence.recorderResourceLoaded && replayEvidence.snapshotItems === 0
      : replayEvidence.initialRecording &&
        replayEvidence.recoveryRecording &&
        replayEvidence.accountBRecording &&
        replayEvidence.fullSnapshots > 0 &&
        replayEvidence.incrementalSnapshots > 0,
    replayEvidence,
  };
  return result;
}