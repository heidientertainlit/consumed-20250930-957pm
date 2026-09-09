export type AppVersionConfig = {
  latest_version: string;
  minimum_supported_version: string;
  app_store_url: string;
};

type ParsedVersion = {
  core: [number, number, number];
  prerelease: Array<number | string>;
};

const VERSION_PATTERN =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemanticVersion(version: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(version.trim());
  if (!match) return null;

  const prerelease = match[4]
    ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease,
  };
}

export function compareSemanticVersions(left: string, right: string): number | null {
  const a = parseSemanticVersion(left);
  const b = parseSemanticVersion(right);
  if (!a || !b) return null;

  for (let index = 0; index < a.core.length; index += 1) {
    if (a.core[index] !== b.core[index]) {
      return a.core[index] < b.core[index] ? -1 : 1;
    }
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;

    const aNumeric = typeof aPart === "number";
    const bNumeric = typeof bPart === "number";
    if (aNumeric && !bNumeric) return -1;
    if (!aNumeric && bNumeric) return 1;
    return aPart < bPart ? -1 : 1;
  }

  return 0;
}

export type UpdateRequirement = "none" | "soft" | "required";

export function getUpdateRequirement(
  installedVersion: string,
  config: AppVersionConfig,
): UpdateRequirement {
  const minimumComparison = compareSemanticVersions(
    installedVersion,
    config.minimum_supported_version,
  );
  const latestComparison = compareSemanticVersions(installedVersion, config.latest_version);

  // Invalid remote or installed values fail open.
  if (minimumComparison === null || latestComparison === null) return "none";
  if (minimumComparison < 0) return "required";
  if (latestComparison < 0) return "soft";
  return "none";
}