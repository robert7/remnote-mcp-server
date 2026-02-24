/**
 * Version compatibility check for 0.x semver.
 *
 * During 0.x development, minor version bumps may contain breaking changes.
 * Compatible iff major.minor match (patch differences are OK).
 */
export function checkVersionCompatibility(
  localVersion: string,
  bridgeVersion: string
): string | null {
  const local = parseVersion(localVersion);
  const bridge = parseVersion(bridgeVersion);

  if (!local || !bridge) {
    return `Cannot parse versions: local=${localVersion}, bridge=${bridgeVersion}`;
  }

  if (local.major !== bridge.major || local.minor !== bridge.minor) {
    return `Version mismatch: server v${localVersion} ↔ bridge v${bridgeVersion}. Minor version must match during 0.x development. See compatibility guide.`;
  }

  return null;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}
