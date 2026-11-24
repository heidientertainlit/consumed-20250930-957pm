---
name: Safety release workflow
description: Preserve the existing automatic development-to-release routine when adding safety gates.
---

The user requested removal of the GitHub Actions setup, not merely a pause.
Do not restore its runnable workflow or Actions-only enforcement unless asked.
Keep useful local verification and the existing guarded Vercel build.

**Why:** The added workflow blocked the user's manual push because its OAuth
authorization lacked workflow scope; the user chose to remove Actions only.

**How to apply:** Preserve the modal correction, TypeScript fixes, recommendation
snapshot and all three Vercel browser guards. Do not interpret file deletion as
proof that earlier outgoing commits can be pushed, and do not rewrite history
or run Git commands to resolve it without authorization.

Preserve the user's existing Replit → GitHub → Vercel workflow and automatic
deployment routine. Do not introduce required feature branches, pull requests,
or additional manual release steps without separate agreement.

**Why:** The user explicitly wants the simplest reliable safety setup, not a
workflow overhaul or changes to application functionality.

**How to apply:** Prepare and verify local testing changes first. Keep existing
build enforcement until the replacement release gate has been proven against
passing, failed, skipped, cancelled, and missing results for the exact commit.

Preview and Vercel intentionally share live Supabase. For the list repairs,
do not require a separate hosted project, ask for its reference, repoint
either environment, or introduce a separate development architecture.

**Why:** The user chose to keep existing infrastructure and deployment while
requiring real security verification before releasing the repairs.

**How to apply:** Use a disposable local stack for rehearsal; reserve managed
gateway, live configuration, and exact production data checks for separate
approval. Exclude app credentials from local browser tests but preserve the
Replit loader/audit runtime variables: clearing those also can make the
pinned browser falsely appear to lack native libraries.

Do not connect Replit to Vercel at all. Investigate using local code, locally
available release configuration, and information already available. When Vercel
evidence is needed, give the user exact dashboard retrieval instructions so
they can retrieve it themselves. Do not change production, enable collections,
or deploy anything without the user's approval.

**Why:** The user explicitly requires the existing Replit → GitHub → Vercel
workflow to remain unchanged and does not authorize a Vercel connection.

**How to apply:** Do not propose or use a Vercel integration. Keep user-supplied
logs distinct from local reproductions and report missing evidence honestly.

For browser startup failures on Vercel, investigate the build image's native
package support before proposing a different release workflow.

**Why:** Vercel documents an Amazon Linux 2023 build image with additional
packages installable through `dnf`; Playwright's Ubuntu fallback browser may
download successfully but fail before tests start because shared libraries
are absent. A downloaded browser is not evidence that the OS can launch it.
The user subsequently confirmed successful Vercel Preview and Production builds
after native dependency installation, without moving browser checks out of
Vercel. This verifies the narrower approach in those build environments, not
repeat-run reliability or complete application behavior.

**How to apply:** Check the actual failing build log and current Vercel build-image
documentation. Preserve every test and distinguish a documented dependency
remedy from a fix verified in Vercel. Do not assume Ubuntu dependency-install
commands work on Amazon Linux.

Use narrowly scoped, ABI-compatible library paths when investigating browsers
on Nix; do not combine every library directory in the store.

**Why:** A broad path selected an old C++ runtime and prevented Node itself from
starting. Existing GTK/GStreamer libraries also did not supply the browser's
required ICU ABI. A host-library launch failure is not a modal assertion failure.

**How to apply:** Diagnose the requested library versions explicitly. Keep
unlaunchable browser checks mandatory and report them as blocked/failed; do not
disable validation, substitute incompatible library symlinks, or call an
unexecuted WebKit suite passing.

Vercel build-log retrieval can truncate individual records at 4,096 characters,
even when querying raw build events.

**Why:** The Vercel agent observed the same diagnostic record truncated at that
boundary through both CLI logs and the raw API, with no continuation record.

**How to apply:** When remote-only failures require structured diagnostics,
keep each record short and independently numbered, and put the failing phase
and final state first. Do not rely on a large JSON line or on files from a
failed build being downloadable.

Keep all agent Git commands prohibited in this project, including read-only
local commit, status, and branch inspection.

**Why:** The user explicitly declined a narrowly scoped exception for read-only
local Git inspection while troubleshooting the rejected workflow upload.

**How to apply:** Use current source files and user-provided Git-panel evidence;
the user controls Git operations through Replit's interface. Do not treat
permission to troubleshoot a push as permission to run Git commands.
