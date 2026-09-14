# Replay prototype browser validation

Run the isolated browser contract fixture with:

```sh
./node_modules/.bin/tsx scripts/validate-replay-prototype.mjs
```

The script runs the checked-in `posthog-js` 1.352.0 distribution and fetches
the exact public npm archive for 1.430.3 only when its local fixture cache is
absent. Before extraction, it verifies the archive against the version-specific
npm registry SRI digest. The regenerated cache is:

```text
/tmp/posthog-replay-sdk-1.430.3/package/dist/
```

Remove that directory to force an integrity-checked regeneration. This does not
install a project dependency or modify production files. The fixture uses the
local Chromium executable at `/repl/tools/bin/chromium`.

The result is local synthetic Chromium evidence only. It does not verify a
published origin, a real provider, real credentials, or iOS behavior.