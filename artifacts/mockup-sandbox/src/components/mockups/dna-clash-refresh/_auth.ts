import { useMemo } from "react";

function getLocalSession() {
  const isGuest = new URLSearchParams(window.location.search).get("case") === "guest";
  return isGuest ? null : {
    access_token: "local-fixture-session",
    user: { id: "fixture-amber" },
  };
}

export function useAuth() {
  const session = useMemo(getLocalSession, []);
  return { session, user: session?.user ?? null, loading: false };
}
