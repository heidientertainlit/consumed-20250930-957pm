export function resolveFirstName(
  canonicalFirstName: unknown,
  metadata: Record<string, unknown> | null | undefined,
): string {
  const canonical = typeof canonicalFirstName === "string" ? canonicalFirstName.trim() : "";
  if (canonical) return canonical;

  for (const key of ["first_name", "firstName"]) {
    const candidate = metadata?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

export function formatDnaGreeting(firstName: string): string {
  const name = firstName.trim();
  return `${name ? `${name.toLocaleUpperCase()}, ` : ""}YOU’RE`;
}
