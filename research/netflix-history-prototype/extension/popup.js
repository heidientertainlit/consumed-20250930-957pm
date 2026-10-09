import { STORAGE_KEY, getProfile, isHistoryUrl, recordCheck } from "./history-model.js";
import { readLoadedHistory } from "./history-reader.js";

const byId = id => document.getElementById(id);
const profileInput = byId("profile-label");
const consent = byId("consent");
const check = byId("check");
const clear = byId("clear");
const hasExtension = Boolean(globalThis.chrome?.storage?.local && globalThis.chrome?.scripting);
let state = null;
let busy = false;
let storageReady = false;

function status(message, kind = "") {
  byId("status").textContent = message;
  byId("status").dataset.kind = kind;
}

function updateControls() {
  check.disabled = !hasExtension || !storageReady || busy || !consent.checked || !profileInput.value.trim();
  clear.disabled = !hasExtension || !storageReady || busy;
  profileInput.disabled = busy;
  consent.disabled = busy;
}

function render() {
  const profile = getProfile(state, profileInput.value);
  byId("saved-count").textContent = profile ? String(profile.entries.length) : "—";
  byId("new-count").textContent = profile ? String(profile.lastNewCount) : "—";
  byId("last-check").textContent = profile
    ? `Last checked ${new Date(profile.lastCheckedAt).toLocaleString()} · ${profile.lastReadCount} loaded rows · ${profile.checks} check(s)`
    : "No history saved for this label.";
  const list = byId("new-entries");
  list.replaceChildren();
  for (const entry of profile?.lastNewEntries ?? []) {
    const li = document.createElement("li");
    const title = document.createElement("span");
    title.textContent = entry.title;
    const date = document.createElement("small");
    date.textContent = entry.dateText;
    li.append(title, date);
    list.append(li);
  }
  if (profile?.lastNewCount > 50) {
    const li = document.createElement("li");
    li.textContent = "Showing the first 50 newly encountered rows.";
    list.append(li);
  }
  updateControls();
}

async function initialize() {
  if (!hasExtension) {
    status("Not running as an extension. Install the extension folder in desktop Chrome or Edge; this page cannot access Netflix.");
    updateControls();
    return;
  }
  try {
    // History is personal data. Prevent page/content scripts from reading this
    // extension's storage; only trusted extension pages need it.
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    const saved = await chrome.storage.local.get(STORAGE_KEY);
    state = saved[STORAGE_KEY] ?? null;
    if (state && (state.version !== 1 || !state.profiles || typeof state.profiles !== "object")) {
      throw new Error("Unrecognized local test data. Remove and reinstall this prototype to reset it.");
    }
    profileInput.value = Object.values(state?.profiles ?? {})[0]?.label ?? "";
    storageReady = true;
    status("Ready. Open Viewing activity in your Netflix tab, confirm its profile, then check.");
    render();
  } catch (error) {
    status(`Local storage could not be initialized: ${error.message}`, "error");
    updateControls();
  }
}

check.addEventListener("click", async () => {
  if (check.disabled) return;
  const label = profileInput.value;
  busy = true;
  updateControls();
  status("Reading already-loaded history rows. No login or network requests are initiated by this test.");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isHistoryUrl(tab.url)) {
      throw new Error("Select your Netflix Viewing activity tab before opening this extension. Other pages are not read.");
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      func: readLoadedHistory,
    });
    const result = results.find(item => item.frameId === 0)?.result;
    if (!result?.ok) throw new Error(result?.error ?? "The page could not be read. Your saved baseline has not changed.");
    const next = recordCheck(state, label, result.entries);
    // Commit only after storage succeeds. Failures preserve the prior baseline.
    await chrome.storage.local.set({ [STORAGE_KEY]: next.state });
    state = next.state;
    render();
    const skipped = result.skippedRows ? ` ${result.skippedRows} unrecognized row(s) were skipped.` : "";
    status(next.baselineCreated
      ? `Baseline saved: ${next.profile.lastReadCount} loaded rows. Check again later using the same Netflix profile and local label.${skipped}`
      : `Checked ${next.profile.lastReadCount} loaded rows; ${next.added.length} not previously saved. A new row is not proof of a recent viewing.${skipped}`, "success");
  } catch (error) {
    status(error.message ?? "The check failed. Your saved baseline has not changed.", "error");
  } finally {
    busy = false;
    consent.checked = false;
    updateControls();
  }
});

clear.addEventListener("click", async () => {
  if (clear.disabled || !window.confirm("Delete all history and profile labels saved by this prototype on this computer? Netflix and Consumed will not be changed.")) return;
  busy = true;
  updateControls();
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    state = null;
    profileInput.value = "";
    consent.checked = false;
    render();
    status("This prototype's local history and labels were deleted. Nothing was changed on Netflix or Consumed.", "success");
  } catch (error) {
    status(`Could not delete local test data: ${error.message}`, "error");
  } finally {
    busy = false;
    updateControls();
  }
});

profileInput.addEventListener("input", render);
consent.addEventListener("change", updateControls);
void initialize();
