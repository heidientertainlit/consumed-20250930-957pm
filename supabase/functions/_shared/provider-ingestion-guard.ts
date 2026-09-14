/**
 * Provider sends must be bound to the current first-party account row.
 *
 * Account deletion removes public.users, so this check intentionally uses the
 * authoritative row instead of an email/name lookup.  A new UUID with the
 * same email is a different account and is allowed when its own row exists.
 *
 * Keep this module free of Supabase/Deno imports so it can be unit tested with
 * a small lookup double and reused by every provider producer.
 */

export type ProviderUserRecord = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  user_name?: string | null;
  created_at?: string | null;
};

export type LiveUserCheck<T extends ProviderUserRecord = ProviderUserRecord> =
  | { allowed: true; user: T }
  | {
      allowed: false;
      reason: "invalid_user_id" | "account_not_found" | "account_lookup_failed";
      error?: unknown;
    };

export type UserLookup<T extends ProviderUserRecord = ProviderUserRecord> = () => Promise<{
  data: T | null;
  error: unknown | null;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Resolve one exact ID against a caller-provided authoritative lookup.
 *
 * Errors and missing rows are never treated as permission to send.  In
 * particular, this function does not fall back to email, display name, or a
 * tombstone table, because those would either broaden the target or couple
 * ingestion to optional deletion storage.
 */
export async function checkLiveUser<T extends ProviderUserRecord>(
  userId: unknown,
  lookup: UserLookup<T>,
): Promise<LiveUserCheck<T>> {
  if (!isUuid(userId)) {
    return { allowed: false, reason: "invalid_user_id" };
  }

  try {
    const result = await lookup();
    if (result.error) {
      return {
        allowed: false,
        reason: "account_lookup_failed",
        error: result.error,
      };
    }

    if (!result.data || result.data.id !== userId) {
      return { allowed: false, reason: "account_not_found" };
    }

    return { allowed: true, user: result.data };
  } catch (error) {
    return { allowed: false, reason: "account_lookup_failed", error };
  }
}

/**
 * Query the exact public.users row immediately before a provider send.
 *
 * The admin client is supplied by the edge function because its service role
 * key must never be imported into this shared module or exposed to clients.
 */
export async function loadLiveUser<
  T extends ProviderUserRecord = ProviderUserRecord,
>(
  admin: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: T | null; error: unknown | null }>;
        };
      };
    };
  },
  userId: unknown,
  columns = "id",
): Promise<LiveUserCheck<T>> {
  return checkLiveUser(userId, async () => {
    const result = await admin
      .from("users")
      .select(columns)
      .eq("id", userId as string)
      .maybeSingle();
    return {
      data: result.data,
      error: result.error,
    };
  });
}