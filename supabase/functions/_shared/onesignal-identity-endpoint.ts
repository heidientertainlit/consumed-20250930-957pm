import {
  issueOneSignalJwt,
  type OneSignalIdentityClaims,
} from "./onesignal-identity.ts";

export const oneSignalIdentityCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...oneSignalIdentityCorsHeaders,
  "Content-Type": "application/json",
};

export type IdentityEndpointDependencies = {
  authenticate: (accessToken: string) => Promise<string | null>;
  loadLiveUser: (userId: string) => Promise<
    | { id: string }
    | null
    | { error: unknown }
  >;
  checkDeletedTombstone?: (userId: string) => Promise<boolean>;
  issue: (userId: string) => Promise<{
    token: string;
    claims: OneSignalIdentityClaims;
  }>;
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Request handler kept independent of Supabase/Deno so tests can exercise the
 * authentication and deletion boundary without calling a real provider.
 */
export function createOneSignalIdentityJwtHandler(
  dependencies: IdentityEndpointDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: oneSignalIdentityCorsHeaders });
    }
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

    // There is intentionally no selector in this API. The only target is the
    // authenticated Supabase subject derived below.
    if ((await request.text()).trim() !== "") {
      return response({ error: "No account selector is accepted" }, 400);
    }

    const accessToken = bearerToken(request);
    if (!accessToken) return response({ error: "Missing authorization" }, 401);

    let userId: string | null;
    try {
      userId = await dependencies.authenticate(accessToken);
    } catch {
      return response({ error: "Unable to verify authorization" }, 503);
    }
    if (!userId || !isUuid(userId)) return response({ error: "Invalid user" }, 401);

    if (dependencies.checkDeletedTombstone) {
      try {
        if (await dependencies.checkDeletedTombstone(userId)) {
          return response({ error: "Account not found" }, 404);
        }
      } catch {
        // A configured tombstone check is a hard safety dependency. Never
        // silently fall back to signing when its result is unavailable.
        return response({ error: "Account status unavailable" }, 503);
      }
    }

    let liveUser: { id: string } | null | { error: unknown };
    try {
      liveUser = await dependencies.loadLiveUser(userId);
    } catch {
      return response({ error: "Account status unavailable" }, 503);
    }
    if ("error" in (liveUser ?? {})) {
      return response({ error: "Account status unavailable" }, 503);
    }
    if (!liveUser || liveUser.id !== userId) {
      return response({ error: "Account not found" }, 404);
    }

    try {
      const issued = await dependencies.issue(userId);
      return response({
        jwt: issued.token,
        expiresAt: issued.claims.exp,
        ttlSeconds: issued.claims.exp - Math.floor(Date.now() / 1000),
      });
    } catch {
      return response({ error: "Identity verification is not configured" }, 503);
    }
  };
}

export { issueOneSignalJwt };