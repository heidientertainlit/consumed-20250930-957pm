/**
 * This visual pilot is intentionally limited to one provider-based TV route.
 * Do not broaden it until the user approves the Terminal List conversation UI.
 */
export function isTerminalListConversationPilot(route?: {
  type?: string | null;
  source?: string | null;
  id?: string | null;
} | null): boolean {
  return route?.type === "tv" && route?.source === "tmdb" && route?.id === "120911";
}
