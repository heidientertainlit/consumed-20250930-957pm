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
        fixture.originalPolicyTimestamp =
          fixture.remoteConfigBeforeWrapperOptIn?.cache_timestamp ?? null;
        if (fixture.expiredPolicyScenario && fixture.originalPolicy) {
          // Advance the fixture clock before the first authorized native
          // reset. The cached timestamp is left intact, making request #2 a
          // genuine TTL refresh that can cross the opt-out boundary.
          fixture.expiredPolicy = fixture.originalPolicy;
          window.__posthogReleaseFixtureClockOffset += 7_200_001;
          fixture.expiredPolicyAge = Date.now() - fixture.originalPolicy.cache_timestamp;
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

        // The initial stale refresh was started above. Opt out before its
        // deliberately delayed response returns; no persistence policy is
        // fabricated or retained by this fixture.
        wrapper.setPostHogCaptureAllowed(false);
        await sleep(250);
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
        // The expired request may complete only after the opt-out boundary.
        // Wait for that real response rather than manufacturing a policy.
        await sleep(fixture.expiredPolicyScenario ? 4_500 : 500);
        fixture.remoteConfigAfterRecoveryOptIn = remoteConfig();
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

        if (fixture.expiredPolicyScenario) {
          const currentPolicy = remoteConfig();
          if (currentPolicy && typeof currentPolicy === "object") {
            fixture.originalPolicyForSwitch = currentPolicy;
            fixture.originalPolicyForSwitchTimestamp = currentPolicy.cache_timestamp ?? null;
            fixture.expiredPolicyForSwitch = currentPolicy;
            window.__posthogReleaseFixtureClockOffset += 7_200_001;
            fixture.expiredPolicyForSwitchAge = Date.now() - currentPolicy.cache_timestamp;
            // This marker follows the second two-hour aging and precedes the
            // actual native reset/opt-in. It proves the delayed request is a
            // fresh expired-policy evaluation, not the earlier guest reset.
            await markPhase("guest-expired");
            // A new anonymous identity is the actual SDK transition that
            // starts a second remote-config evaluation after the guest policy
            // has become stale.
            wrapper.resetUser();
            wrapper.setPostHogCaptureAllowed(true, null);
          }
          await sleep(400);
          fixture.guestState = state();
          fixture.guestSessionId = fixture.guestState.sessionId;
          wrapper.trackEvent("release_guest", {
            phase: "guest", identity: "guest", normal: true,
          });
        } else {
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
        }
        await sleep(fixture.expiredPolicyScenario ? 0 : 150);
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
        await sleep(fixture.expiredPolicyScenario ? 5_500 : 500);
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

export function attributionControlScript() {
  return `
  <script src="/assets/posthog-wrapper.js"></script>
  <script>
    (async () => {
      const fixture = window.__posthogReleaseFixture;
      const wrapper = window.PosthogReleaseWrapper;
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
      const remoteConfig = () => window.posthog.persistence?.props?.$session_recording_remote_config ?? null;
      try {
        fixture.attributionUrl = window.location.href;
        fixture.attributionReferrer = document.referrer;
        wrapper.initPostHog();
        await sleep(800);
        fixture.remoteConfigBeforeWrapperOptIn = clone(remoteConfig());

        wrapper.setPostHogCaptureAllowed(true, "${fakeUserId}");
        await sleep(800);
        fixture.remoteConfigAfterWrapperOptIn = clone(remoteConfig());
        wrapper.identifyUser("${fakeUserId}", {
          email: "fixture@example.test",
          display_name: "Attribution Fixture User",
        });
        wrapper.trackEvent("release_attribution_probe", {
          phase: "attribution", normal: true,
        });
        window.posthog.capture("sdk_attribution_probe", {
          phase: "attribution", direct: true,
        });
        window.posthog.flush?.();
        await sleep(1_800);

        fixture.persistenceProps = clone(window.posthog.persistence?.props || {});
        fixture.sessionPersistenceProps = clone(window.posthog.sessionPersistence?.props || {});
        fixture.sdkConfig = {
          saveCampaignParams: window.posthog.config?.save_campaign_params,
          capturePerformance: clone(window.posthog.config?.capture_performance),
        };
        fixture.metaCookieReadCount = window.__posthogReleaseMetaCookieReadCount;
        fixture.metaCookieReadInstrumentation =
          window.__posthogReleaseMetaCookieReadInstrumentation === true;
        fixture.ready = true;
      } catch (error) {
        fixture.errors.push(String(error));
      }
    })();
  </script>`;
}

function findMetaIdentifierReferences(value, path = "root", references = []) {
  if (value === null || value === undefined) return references;
  if (typeof value === "string") {
    if (value === "fb.1.1700000000.fixturefreshclick" ||
      value === "fb.1.1700000000.1234567890") {
      references.push({ path, value });
    }
    return references;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findMetaIdentifierReferences(
      entry, `${path}[${index}]`, references,
    ));
    return references;
  }
  if (typeof value !== "object") return references;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:^|[$_])fb[cp](?:$|_)/i.test(key)) {
      references.push({ path: `${path}.${key}`, value: child });
    }
    findMetaIdentifierReferences(child, `${path}.${key}`, references);
  }
  return references;
}

export function assertAttributionRegression({
  scenario,
  state,
  fixture,
  events,
  namedEvents,
  externalAborted,
  posthogRerouted,
}) {
  const configRequests = fixture.requests.filter((request) => request.kind === "remote-config");
  const configScriptRequests = fixture.requests.filter(
    (request) => request.kind === "remote-config-script-fallback",
  );
  const probeEvents = events.filter((item) => [
    "release_attribution_probe", "sdk_attribution_probe", "$identify",
  ].includes(eventName(item)));
  const directUtmKeys = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  ];
  const initialPersonInfo = state.persistenceProps?.$initial_person_info;
  const clientSessionProps = state.persistenceProps?.$client_session_props;
  const expectedUrl = `${fixture.origin}/?utm_source=fixture-source` +
    "&utm_medium=fixture-medium&utm_campaign=fixture-campaign" +
    "&utm_content=fixture-content&utm_term=fixture-term";
  const expectedReferrer = `${fixture.origin}/referrer?referrer_source=fixture-referrer`;
  const replayEvidence = {
    configScriptStatus: configScriptRequests[0]?.responseStatus,
    configStatus: configRequests[0]?.responseStatus,
    configResponse: configRequests[0]?.response,
    remoteConfigBeforeWrapperOptIn: state.remoteConfigBeforeWrapperOptIn,
    remoteConfigAfterWrapperOptIn: state.remoteConfigAfterWrapperOptIn,
    sdkConfig: state.sdkConfig,
    metaCookieReadCount: state.metaCookieReadCount,
    metaCookieReadInstrumentation: state.metaCookieReadInstrumentation,
    initialPersonInfo,
    clientSessionProps,
    sessionPersistenceProps: state.sessionPersistenceProps,
    attributionUrl: state.attributionUrl,
    attributionReferrer: state.attributionReferrer,
    probeEvents: probeEvents.map((item) => eventName(item)),
    requestPaths: fixture.requests.map((request) => request.path),
  };

  assert.equal(externalAborted.length, 0,
    `${scenario.name}: unexpected external requests ${externalAborted.join(", ")}`);
  assert.ok(posthogRerouted.length,
    `${scenario.name}: no published-host requests were locally intercepted`);
  assert.ok(state.initCalls?.length, `${scenario.name}: initPostHog did not call the SDK`);
  const init = state.initCalls[0];
  assert.equal(init.key, "phc_local_release_regression_only",
    `${scenario.name}: fake key changed`);
  assert.equal(init.config.api_host, "https://us.i.posthog.com",
    `${scenario.name}: host changed`);
  assert.equal(init.config.api_transport, "fetch",
    `${scenario.name}: transport changed`);
  assert.equal(init.config.request_batching, true,
    `${scenario.name}: batching changed`);
  assert.equal(init.config.capture_pageview, false,
    `${scenario.name}: pageview capture changed`);
  assert.equal(init.config.capture_pageleave, true,
    `${scenario.name}: pageleave capture changed`);
  assert.equal(init.config.save_campaign_params, false,
    `${scenario.name}: campaign parameter persistence changed`);
  assert.deepEqual(init.config.capture_performance, { web_vitals_attribution: false },
    `${scenario.name}: web-vitals attribution config changed`);
  assert.deepEqual(state.sdkConfig?.capturePerformance, { web_vitals_attribution: false },
    `${scenario.name}: SDK did not retain web-vitals attribution config`);
  assert.equal(state.sdkConfig?.saveCampaignParams, false,
    `${scenario.name}: SDK did not retain campaign persistence config`);
  assert.equal(configScriptRequests[0]?.responseStatus, 404,
    `${scenario.name}: config.js fallback was not exercised`);
  assert.equal(configRequests[0]?.responseStatus, 200,
    `${scenario.name}: remote JSON config did not load`);
  assert.deepEqual(configRequests[0]?.response, {
    sessionRecording: {
      sampleRate: 1,
      minimumDurationMilliseconds: 0,
      maskAllInputs: true,
    },
    autocapture_opt_out: false,
  }, `${scenario.name}: remote config schema changed`);
  assert.equal(state.remoteConfigBeforeWrapperOptIn?.enabled, true,
    `${scenario.name}: remote recording enablement was not retained`);

  assert.equal(state.metaCookieReadInstrumentation, true,
    `${scenario.name}: Meta-cookie read instrumentation was not installed`);
  assert.equal(state.metaCookieReadCount, 0,
    `${scenario.name}: save_campaign_params=false read a fresh Meta cookie`);
  assert.ok(namedEvents.includes("release_attribution_probe"),
    `${scenario.name}: wrapper attribution probe was not emitted`);
  assert.ok(namedEvents.includes("sdk_attribution_probe"),
    `${scenario.name}: direct SDK attribution probe was not emitted`);
  assert.ok(probeEvents.length, `${scenario.name}: no attribution probe events were captured`);
  for (const item of events) {
    const properties = itemProperties(item);
    for (const key of directUtmKeys) {
      assert.equal(Object.prototype.hasOwnProperty.call(properties, key), false,
        `${scenario.name}: direct ${key} escaped with save_campaign_params=false`);
    }
  }
  for (const [name, store] of [
    ["persistence", state.persistenceProps],
    ["session persistence", state.sessionPersistenceProps],
  ]) {
    for (const key of directUtmKeys) {
      assert.equal(Object.prototype.hasOwnProperty.call(store || {}, key), false,
        `${scenario.name}: direct ${key} was stored in ${name}`);
    }
  }

  assert.equal(state.attributionUrl, expectedUrl,
    `${scenario.name}: attribution URL was not retained`);
  assert.equal(new URL(state.attributionUrl).searchParams.has("fbclid"), false,
    `${scenario.name}: conditional Meta-cookie regression fixture unexpectedly had fbclid`);
  assert.ok(probeEvents.some((item) => itemProperties(item).$current_url === expectedUrl),
    `${scenario.name}: emitted event lost its current attribution URL`);
  assert.equal(state.attributionReferrer, expectedReferrer,
    `${scenario.name}: referrer URL was not retained`);
  assert.equal(typeof initialPersonInfo?.u, "string",
    `${scenario.name}: initial person URL was not persisted`);
  assert.ok(initialPersonInfo.u.includes(expectedUrl),
    `${scenario.name}: initial person URL lost its query/referrer attribution`);
  assert.equal(initialPersonInfo.r, expectedReferrer,
    `${scenario.name}: initial person referrer URL was not persisted`);
  assert.equal(typeof clientSessionProps?.props?.u, "string",
    `${scenario.name}: session entry URL was not persisted`);
  assert.ok(clientSessionProps.props.u.includes(expectedUrl),
    `${scenario.name}: session entry URL lost its query attribution`);
  assert.equal(clientSessionProps.props.r, expectedReferrer,
    `${scenario.name}: session entry referrer URL was not persisted`);
  assert.equal(state.sessionPersistenceProps?.$referrer, expectedReferrer,
    `${scenario.name}: event referrer URL was not retained`);

  const metaIdentifierReferences = [
    ...findMetaIdentifierReferences(events, "events"),
    ...findMetaIdentifierReferences(state.persistenceProps, "persistence"),
    ...findMetaIdentifierReferences(state.sessionPersistenceProps, "sessionPersistence"),
  ];
  assert.deepEqual(metaIdentifierReferences, [],
    `${scenario.name}: fresh Meta identifiers escaped events or persistence ` +
      `${JSON.stringify(metaIdentifierReferences)}`);

  return {
    scenario: scenario.name,
    mode: "actual-wrapper-attribution-regression:installed-sdk",
    requestPaths: fixture.requests.map((request) => request.path),
    events: namedEvents,
    replayRecovered: true,
    replayEvidence,
  };
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
  const configScriptRequests = fixture.requests.filter(
    (request) => request.kind === "remote-config-script-fallback",
  );
  const replayDisabled = scenario.recordingDisabled || scenario.recordingSampleRate === 0;
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
    configScriptStatus: configScriptRequests[0]?.responseStatus,
    configStatus: configRequests[0]?.responseStatus,
    configScriptStatuses: configScriptRequests.map((request) => request.responseStatus),
    configRequests: configRequests.length,
    configDelays: configRequests.map((request) => request.delayMs || 0),
    configResponses: configRequests.map((request) => request.response),
    sampleRates: configRequests.map((request) => request.response?.sessionRecording?.sampleRate),
    configPhases: configRequests.map((request) => ({
      phaseAtRequest: request.phaseAtRequest,
      phaseAtResponse: request.phaseAtResponse,
      delayMs: request.delayMs || 0,
    })),
    originalPolicy: policyFields(state.originalPolicy),
    originalPolicyTimestamp: state.originalPolicyTimestamp,
    expiredPolicy: policyFields(state.expiredPolicy),
    expiredPolicyAge: state.expiredPolicyAge,
    originalPolicyForSwitch: policyFields(state.originalPolicyForSwitch),
    originalPolicyForSwitchTimestamp: state.originalPolicyForSwitchTimestamp,
    expiredPolicyForSwitch: policyFields(state.expiredPolicyForSwitch),
    expiredPolicyForSwitchAge: state.expiredPolicyForSwitchAge,
    persistedConfigBeforeWrapperOptIn: state.remoteConfigBeforeWrapperOptIn,
    persistedConfigAfterWrapperOptIn: state.remoteConfigAfterWrapperOptIn,
    persistedConfigAfterReset: state.remoteConfigAfterReset,
    persistedConfigAfterRecoveryOptIn: state.remoteConfigAfterRecoveryOptIn,
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
      [
        state.remoteConfigBeforeWrapperOptIn,
        state.remoteConfigAfterWrapperOptIn,
        state.remoteConfigAfterReset,
        state.remoteConfigAfterRecoveryOptIn,
      ].every((policy) => policy == null || policy.enabled === false),
    resetClearedCachedRemoteConfig:
      !!state.remoteConfigBeforeWrapperOptIn && !state.remoteConfigAfterReset,
    remoteReplayPolicyNotOverridden:
      !Object.prototype.hasOwnProperty.call(state.initCalls?.[0]?.config || {}, "session_recording"),
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
  assert.equal(init.config.save_campaign_params, false,
    `${scenario.name}: campaign persistence changed`);
  assert.deepEqual(init.config.capture_performance, { web_vitals_attribution: false },
    `${scenario.name}: web-vitals attribution changed`);
  assert.equal(replayEvidence.remoteReplayPolicyNotOverridden, true,
    `${scenario.name}: wrapper locally overrode remote replay retention`);
  assert.ok(configScriptRequests.length >= 1 &&
    configScriptRequests.every((request) => request.responseStatus === 404),
  `${scenario.name}: config.js 404 -> JSON fallback was not preserved`);
  assert.equal(configRequests[0]?.responseStatus, 200,
    `${scenario.name}: initial local JSON remote config did not load`);

  if (replayDisabled) {
    assert.ok(configRequests.length >= 1, `${scenario.name}: disabled config did not load`);
    const expectedRecordingPolicy = scenario.recordingDisabled
      ? false
      : { sampleRate: 0, minimumDurationMilliseconds: 0, maskAllInputs: true };
    assert.ok(configRequests.every((request) =>
      JSON.stringify(request.response?.sessionRecording) === JSON.stringify(expectedRecordingPolicy)
    ), `${scenario.name}: disabled recording policy changed`);
    assert.equal(snapshotItems.length, 0,
      `${scenario.name}: disabled recording emitted snapshots`);
    if (scenario.recordingDisabled) {
      assert.equal(state.sdkState?.recording, false, `${scenario.name}: disabled recording started`);
      for (const phase of ["initialState", "recoveryState", "guestState", "accountBState"]) {
        assert.equal(state[phase]?.recording, false,
          `${scenario.name}: disabled recording started in ${phase}`);
      }
      assert.equal(replayEvidence.recorderResourceLoaded, false,
        `${scenario.name}: disabled recording loaded rrweb`);
      assert.equal(replayEvidence.disabledPolicyNotManufactured, true,
        `${scenario.name}: disabled server policy was manufactured locally`);
    } else {
      // Sampling is applied to emitted replay payloads, not necessarily to
      // recorder construction/status. Assert the privacy outcome directly.
      assert.equal(replayEvidence.snapshotItems, 0,
        `${scenario.name}: sampleRate 0 emitted a replay snapshot`);
    }
  } else {
    assert.equal(state.remoteConfigBeforeWrapperOptIn?.enabled, true,
      `${scenario.name}: remote recording enablement was not retained`);
    assert.deepEqual(configRequests[0]?.response, {
      sessionRecording: { sampleRate: 1, minimumDurationMilliseconds: 0, maskAllInputs: true },
      autocapture_opt_out: false,
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
          request.phaseAtRequest === "guest-expired" &&
          ["account-switch-optout", "account-b"].includes(request.phaseAtResponse),
        ),
        `${scenario.name}: expired policy response did not cross account switch ${JSON.stringify(replayEvidence)}`,
      );
      assert.equal(
        replayEvidence.originalPolicy?.cache_timestamp,
        replayEvidence.expiredPolicy?.cache_timestamp,
        `${scenario.name}: expiry fixture changed the original timestamp`,
      );
      assert.equal(
        replayEvidence.originalPolicy?.cache_timestamp,
        replayEvidence.originalPolicyTimestamp,
        `${scenario.name}: expired-policy fixture mutated the original timestamp`,
      );
      assert.ok(replayEvidence.expiredPolicyAge > 7_200_000,
        `${scenario.name}: expiry fixture did not exceed the one-hour TTL`);
      assert.equal(
        replayEvidence.originalPolicyForSwitch?.cache_timestamp,
        replayEvidence.expiredPolicyForSwitch?.cache_timestamp,
        `${scenario.name}: account-switch expiry fixture changed the original timestamp`,
      );
      assert.equal(
        replayEvidence.originalPolicyForSwitch?.cache_timestamp,
        replayEvidence.originalPolicyForSwitchTimestamp,
        `${scenario.name}: account-switch expiry fixture mutated the original timestamp`,
      );
      assert.ok(replayEvidence.expiredPolicyForSwitchAge > 7_200_000,
        `${scenario.name}: account-switch expiry fixture did not exceed the one-hour TTL`);
    } else {
      // The installed SDK's native reset owns the remote-policy lifecycle.
      // Require the actual remote response and reject a wrapper-local policy
      // override rather than manufacturing the old helper's cache behavior.
      assert.equal(replayEvidence.remoteReplayPolicyNotOverridden, true,
        `${scenario.name}: wrapper locally overrode remote replay policy`);
      assert.equal(state.remoteConfigAfterRecoveryOptIn?.enabled, true,
        `${scenario.name}: native SDK reset did not retain remote replay enablement`);
    }
    assert.ok(replayEvidence.recorderResourceLoaded,
      `${scenario.name}: local rrweb recorder was not loaded`);
    if (scenario.expiredPolicy) {
      assert.equal(replayEvidence.initialRecording, false,
        `${scenario.name}: stale initial config started replay before it returned`);
    } else {
      assert.equal(replayEvidence.initialRecording, true,
        `${scenario.name}: initial replay did not start before recovery`);
    }
    assert.equal(replayEvidence.recoveryRecording, true,
      `${scenario.name}: opt-out -> reset -> opt-in replay did not recover`);
    if (!scenario.expiredPolicy) {
      assert.equal(replayEvidence.guestRecording, true,
        `${scenario.name}: guest replay did not start after logout`);
    }
    assert.equal(replayEvidence.accountBRecording, true,
      `${scenario.name}: different-account replay did not start`);
    assert.ok(replayEvidence.fullSnapshots > 0, `${scenario.name}: no full snapshot`);
    assert.ok(replayEvidence.incrementalSnapshots > 0, `${scenario.name}: no incremental snapshot`);
    if (!scenario.expiredPolicy) {
      assert.equal(replayEvidence.initialSnapshotHasAccountADom, true,
        `${scenario.name}: initial snapshot omitted account A DOM`);
    }
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
    mode: "actual-wrapper-rich-identity-and-replay:installed-sdk-reset",
    requestPaths: fixture.requests.map((request) => request.path),
    events: namedEvents,
    replayRecovered: replayDisabled
      ? scenario.recordingDisabled
        ? !replayEvidence.recorderResourceLoaded && replayEvidence.snapshotItems === 0
        : replayEvidence.snapshotItems === 0
      : (scenario.expiredPolicy || replayEvidence.initialRecording) &&
        replayEvidence.recoveryRecording &&
        replayEvidence.accountBRecording &&
        replayEvidence.fullSnapshots > 0 &&
        replayEvidence.incrementalSnapshots > 0,
    replayEvidence,
  };
  return result;
}