export const STORAGE_KEY = "netflix_history_access_test_v1";
export const MAX_PROFILES = 3;
export const MAX_ENTRIES = 2500;

const clean = (value, length) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, length);

export function isHistoryUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["netflix.com", "www.netflix.com"].includes(url.hostname) &&
      !url.username && !url.password &&
      /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:viewingactivity|wiviewingactivity|settings\/viewing-history)\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function normalizeEntries(entries) {
  if (!Array.isArray(entries)) throw new Error("The history reader returned an invalid result.");
  const unique = new Map();
  for (const item of entries) {
    const title = clean(item?.title, 300);
    const dateText = clean(item?.dateText, 80);
    if (!title || !dateText) continue;
    const titleId = /^\d{1,20}$/.test(String(item?.titleId ?? "")) ? String(item.titleId) : null;
    // Keep episode text: a series-level provider ID alone cannot distinguish episodes.
    const key = JSON.stringify([titleId, title, dateText]);
    unique.set(key, { key, title, dateText, titleId });
  }
  return [...unique.values()];
}

export function recordCheck(state, label, entries, now = new Date().toISOString()) {
  const name = clean(label, 60);
  if (!name) throw new Error("Enter a local label for the Netflix profile you selected.");
  const records = normalizeEntries(entries);
  if (!records.length) throw new Error("No recognizable history rows were read. Your saved baseline has not changed.");
  const current = state ?? { version: 1, profiles: {} };
  if (current.version !== 1 || !current.profiles || typeof current.profiles !== "object") {
    throw new Error("Unsupported local data format. Clear this prototype's local data before continuing.");
  }
  // Prefix prevents user labels from colliding with Object prototype property names.
  const scopeKey = `profile:${name.toLocaleLowerCase("en-US")}`;
  const previous = current.profiles[scopeKey];
  if (!previous && Object.keys(current.profiles).length >= MAX_PROFILES) {
    throw new Error("This test supports three local profile labels. Clear local data to start again.");
  }
  const known = new Map((previous?.entries ?? []).map(item => [item.key, item]));
  const added = records.filter(item => !known.has(item.key));
  for (const item of records) known.set(item.key, item);
  if (known.size > MAX_ENTRIES) {
    throw new Error("The local test reached its 2,500-row profile limit. Nothing was saved or silently truncated.");
  }
  const profile = {
    label: previous?.label ?? name,
    entries: [...known.values()],
    firstCheckedAt: previous?.firstCheckedAt ?? now,
    lastCheckedAt: now,
    checks: (previous?.checks ?? 0) + 1,
    lastReadCount: records.length,
    lastNewCount: previous ? added.length : 0,
    lastNewEntries: previous ? added.slice(0, 50) : [],
  };
  return {
    state: { version: 1, profiles: { ...current.profiles, [scopeKey]: profile } },
    profile,
    baselineCreated: !previous,
    added: previous ? added : [],
  };
}

export function getProfile(state, label) {
  const key = `profile:${clean(label, 60).toLocaleLowerCase("en-US")}`;
  return state?.profiles?.[key] ?? null;
}
