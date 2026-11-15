import { fixtureProfiles, getFixtureVotes } from "./fixture-data";

type QueryResult = { data: any; error: null };

function fixtureQuery(table: string) {
  let ids: string[] | undefined;
  const query: any = {
    select: () => query,
    eq: () => query,
    in: (_column: string, values: string[]) => {
      ids = values;
      return query;
    },
    insert: async () => ({ data: null, error: null }),
    then: (resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) => {
      const data = table === "user_predictions"
        ? getFixtureVotes()
        : table === "public_user_profiles"
          ? fixtureProfiles.filter((profile) => !ids || ids.includes(profile.id))
          : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

function localSession() {
  const isGuest = new URLSearchParams(window.location.search).get("case") === "guest";
  return isGuest ? null : {
    access_token: "local-fixture-session",
    user: { id: "fixture-amber" },
  };
}

/** Sandbox-only Supabase fixture. No method reaches a Supabase service. */
export const supabase = {
  from: (table: string) => fixtureQuery(table),
  rpc: async (_name: string, _args?: unknown) => ({ data: null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: localSession() }, error: null }),
  },
  functions: {
    invoke: async (..._args: unknown[]): Promise<{ data: any; error: Error }> => ({
      data: null,
      error: new Error("Network actions are disabled in the mockup sandbox."),
    }),
  },
};
