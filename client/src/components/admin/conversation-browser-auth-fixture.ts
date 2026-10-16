/** Only aliased by the isolated browser runner; never imported by the application. */
export function useAuth() {
  return { session: { access_token: "isolated-fixture-token" } };
}
