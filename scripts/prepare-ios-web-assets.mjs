import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv('production', join(root, 'client'), 'VITE_');

// Check the existing build configuration without changing or printing it.
if (env.VITE_POSTHOG_CONTROLLED_INGESTION === 'true') {
  throw new Error('Stopped: controlled PostHog ingestion must remain disabled for this release.');
}
if (!env.VITE_POSTHOG_KEY?.trim()) {
  throw new Error(
    'Stopped: the existing VITE_POSTHOG_KEY build configuration is missing. ' +
    'Without it, initialization and labeling would be compiled out. No token was changed.',
  );
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

async function assetManifest(directory, prefix = '') {
  const entries = await readdir(join(directory, prefix), { withFileTypes: true });
  const result = {};
  for (const entry of entries) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) {
      Object.assign(result, await assetManifest(directory, relative));
    } else if (entry.isFile()) {
      result[relative] = createHash('sha256')
        .update(await readFile(join(directory, relative)))
        .digest('hex');
    }
  }
  return result;
}

run('npm', ['run', 'build']);

const webRoot = join(root, 'dist/public');
const nativeRoot = join(root, 'ios/App/App/public');
const html = await readFile(join(webRoot, 'index.html'), 'utf8');
const entryPath = html.match(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/)?.[1];
if (!entryPath) throw new Error('Built web entry script was not found; iOS copy was not started.');
const bundle = await readFile(join(webRoot, entryPath.slice(1)), 'utf8');
for (const marker of ['web_app', 'ios_app', 'before_send', 'isNativePlatform', 'getPlatform']) {
  if (!bundle.includes(marker)) {
    throw new Error(`Built bundle is missing labeling marker ${marker}; iOS copy was not started.`);
  }
}

// Copy only: do not sync dependencies, run CocoaPods, change versions, or archive.
run('npx', ['--no-install', 'cap', 'copy', 'ios']);

const [built, copied] = await Promise.all([
  assetManifest(webRoot),
  assetManifest(nativeRoot),
]);
for (const [file, hash] of Object.entries(built)) {
  if (copied[file] !== hash) throw new Error(`Copied iOS asset differs from the latest build: ${file}`);
}
const nativeConfig = JSON.parse(await readFile(join(root, 'ios/App/App/capacitor.config.json'), 'utf8'));
if (nativeConfig.server?.url) {
  throw new Error('Native configuration loads a remote web root; packaged-asset verification is insufficient.');
}

console.log(JSON.stringify({
  status: 'verified',
  webEntry: entryPath,
  entrySha256: built[entryPath.slice(1)],
  copiedBuildFilesVerified: Object.keys(built).length,
  controlledIngestion: 'disabled',
  nativeLoading: 'packaged assets',
  physicalIPhoneVerification: 'required before App Store submission',
}, null, 2));