# Isolated Netflix history access test

This is an experimental desktop Chrome/Edge extension, **not a Consumed feature**.
No existing app files, dependencies, iOS files, workflows, database schemas, or
deployment settings are part of this prototype.

## What this version actually tests

A user explicitly opens Netflix's Viewing activity page and invokes the extension.
The extension reads recognized **already-loaded history rows**, saves a local
baseline, and compares a later user-initiated check with it. It never logs in,
captures session cookies, calls private APIs, clicks Show More, or schedules checks.

This can test whether history is readable in the existing browser session on
repeated checks. **It does not prove full-history retrieval, automatic background
sync, durable credential access, or iPhone compatibility.**

Netflix's terms restrict automated access. This prototype is not Netflix-approved
and building it does not establish permission to use it. Resolve appropriate
authorization and legal review before using it against a real account, especially
before commercial use. User consent is not provider permission. Do not bypass
security challenges, access blocks, or a request to stop.

## Install separately, on your own computer

1. Download `netflix-history-local-test.zip` from this folder and extract it, or
   download the `extension` folder directly. The archive's top-level README is
   instructions; **select its `extension` subfolder** when loading it.
2. Use a dedicated desktop Chrome or Edge profile. Do not sign into Consumed,
   development services, or browser sync in that profile.
3. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
4. Enable Developer mode, choose **Load unpacked**, and select `extension`.
5. Pin **Netflix History — Local Access Test** in the browser toolbar.

It is not a mobile-browser extension. Nothing needs to be installed in Consumed.
No root package install, build, Capacitor sync, server, or deployment is needed.

## Real-account procedure — only after authorization is addressed

1. Sign into **Netflix itself**. Never paste passwords, cookies, or tokens into
   this project or chat. Select your own authorized Netflix profile.
2. In Netflix's account settings, open that profile's **Viewing activity**.
   Supported paths are `/viewingactivity`, `/wiviewingactivity`, and
   `/settings/viewing-history`, with optional locale prefixes.
3. Let the rows load. Open the pinned extension, enter a local profile label,
   confirm the checkbox, and choose **Check loaded history**.
4. Verify the row count; the first successful check creates a baseline. The
   checkbox deliberately resets after every attempt.
5. Watch something normally on Netflix. Allow Netflix time to record it.
6. Reopen the same profile's Viewing activity, open the extension, use the same
   label, confirm, and check again. Look for the new title/date.
7. Repeat after closing/reopening the browser to investigate session persistence.
   If Netflix requires login again, record that observation; the prototype does
   not circumvent it.

Opening a new profile under an old local label mixes histories. The label is
user-supplied and **does not verify the active Netflix profile**; visually check
the selected profile every time. Use a different label for a different profile.

“Not in baseline” means newly encountered, not necessarily newly watched:
manually loading older rows also produces differences. Title + displayed date +
provider ID are used for deduplication; repeat views of the same title on the
same displayed date cannot be distinguished. Dates are preserved as displayed,
not guessed across locales. No completion, duration, ratings, or likes are inferred.

## Protection boundaries

- Manifest permissions: `activeTab`, `scripting`, and `storage` only. No persistent
  host permission, cookie permission, background worker, content script, alarms,
  external connections, telemetry, or automatic page collection.
- Both the popup and injected reader reject non-Netflix and non-history URLs.
- The reader examines recognized title/date rows only. It does not inspect input
  values, capture full HTML, mutate the page, navigate, or make network requests.
- The popup's CSP blocks network connections. It renders provider text through
  `textContent`, never through HTML injection.
- History is stored in this extension's **local** Chrome storage, not browser
  sync or a database. Local storage is not encrypted: anyone with access to this
  computer/browser profile may access it. No Netflix credentials are stored.
- Storage is restricted to trusted extension contexts. Delete local test data
  using the button, or remove the extension. Nothing is deleted on Netflix.
- Maximum 1,000 loaded DOM rows per check, 2,500 saved rows per profile, and
  three local profile labels. Overflow fails explicitly, preserving the baseline.
- Unknown layouts and empty/error results do not overwrite saved history.
- This directory is outside Consumed's current Vite entry and TypeScript source
  includes. **Do not import it into the app or copy it to `client/public`.**
- Folder separation is not a runtime security boundary. Run real account tests
  on the separate browser/computer, not in this credentialed app workspace.

## Offline verification

From the workspace root, using only existing tools:

```sh
node --test research/netflix-history-prototype/tests/model.test.mjs
node research/netflix-history-prototype/tests/browser.test.mjs
node research/netflix-history-prototype/tests/extension-load.test.mjs
```

Browser tests use intercepted synthetic pages and stubbed extension APIs. They
do not authenticate to or contact Netflix, Consumed, Supabase, or analytics.
Fixture success is **not real Netflix verification**.

The extension-load test additionally checks the real Chromium extension runtime
and local storage with outbound page requests blocked. It uses an existing system
Chromium in this workspace, avoiding package installs. It does not test account
access or whether today's Netflix page layout matches the reader.

Only the files inside `extension/` and this README belong in the install archive.
Tests and the optional local visual-preview server are development tools, not
runtime dependencies. The extension needs no npm packages.
