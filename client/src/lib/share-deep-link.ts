const SHARE_ORIGIN = "https://app.consumedapp.com";
export const PENDING_SHARED_ROUTE = "pendingSharedRoute";
export const SHARED_ROUTE_EVENT = "consumed:shared-route";

const segment = "[^/?#%]+";
const sharePaths = [
  new RegExp(`^/media/${segment}/${segment}/${segment}(?:/${segment})?$`),
  new RegExp(`^/invite/${segment}$`),
  new RegExp(`^/u/${segment}$`),
  new RegExp(`^/edna/${segment}$`),
  new RegExp(`^/list/${segment}$`),
  new RegExp(`^/rank/${segment}$`),
  new RegExp(`^/people/tribes/${segment}$`),
  /^\/leaderboard$/,
  /^\/play$/,
];

/** Only known public share paths on the app's exact HTTPS origin may enter native routing. */
export function sharedRouteFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== SHARE_ORIGIN || url.protocol !== "https:" || url.hash) return null;
    if (!sharePaths.some((pattern) => pattern.test(url.pathname))) return null;
    if ([...url.searchParams.keys()].some((key) => /token|code|secret|password|oauth|error/i.test(key))) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function sharedRouteFromPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return sharedRouteFromUrl(`${SHARE_ORIGIN}${value}`);
}