// Passed to chrome.scripting.executeScript. Keep self-contained: no external
// variables, requests, cookies, input values, clicking, or page modifications.
export function readLoadedHistory() {
  const url = new URL(location.href);
  const allowedPath = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/(?:viewingactivity|wiviewingactivity|settings\/viewing-history)\/?$/i;
  if (url.protocol !== "https:" ||
      !["netflix.com", "www.netflix.com"].includes(url.hostname) ||
      url.username || url.password || !allowedPath.test(url.pathname)) {
    return { ok: false, error: "Open your Netflix profile's Viewing activity page first." };
  }
  const visible = element => element && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";
  const text = (element, max) => element?.textContent?.replace(/\s+/g, " ").trim().slice(0, max) ?? "";
  const rows = [...document.querySelectorAll(
    '.retableRow, [data-uia="viewing-activity-row"], [data-uia="viewing-history-row"], table tbody tr'
  )].filter(visible);
  if (rows.length > 1000) {
    return { ok: false, error: "More than 1,000 rows are loaded. This bounded test will not collect or truncate them." };
  }
  const entries = [];
  for (const row of rows) {
    const titleNode = row.querySelector('.title, [data-uia="title"], [data-uia="viewing-activity-title"]');
    const dateNode = row.querySelector('.date, [data-uia="date"], [data-uia="viewing-activity-date"], time');
    let titleLink = null;
    for (const anchor of row.querySelectorAll('a[href]')) {
      try {
        const target = new URL(anchor.getAttribute("href"), location.origin);
        if (target.origin === location.origin && /^\/(?:title|watch)\/\d+\/?$/.test(target.pathname)) {
          titleLink = anchor;
          break;
        }
      } catch {
        // An invalid link is not evidence of a title.
      }
    }
    if (!visible(dateNode) || !visible(titleNode ?? titleLink)) continue;
    const title = text(titleNode ?? titleLink, 300);
    const dateText = text(dateNode, 80);
    if (!title || !dateText) continue;
    const match = titleLink
      ? new URL(titleLink.getAttribute("href"), location.origin).pathname.match(/\/(?:title|watch)\/(\d+)/)
      : null;
    entries.push({ title, dateText, titleId: match?.[1] ?? null });
  }
  if (!entries.length) {
    return {
      ok: false,
      error: "No supported, loaded viewing-history rows were found. Sign in directly on Netflix, open Viewing activity, and wait for the rows. An unfamiliar page layout also causes this error; no baseline is changed.",
    };
  }
  return { ok: true, entries, matchedRows: rows.length, skippedRows: rows.length - entries.length };
}
