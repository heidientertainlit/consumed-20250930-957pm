// Existing API contracts, not a new identifier scheme. "All" is virtual.
export const SYSTEM_LIST_TITLES = [
  "Currently", "Want To", "Finished", "Did Not Finish", "Favorites",
] as const;
export type SystemListTitle = (typeof SYSTEM_LIST_TITLES)[number];
export const SYSTEM_LIST_API_TITLES: Readonly<Record<string, SystemListTitle>> = {
  currently: "Currently", queue: "Want To", want_to: "Want To",
  finished: "Finished", completed: "Finished",
  dnf: "Did Not Finish", "did-not-finish": "Did Not Finish",
  favorites: "Favorites",
};
export function isSystemListTitle(value: unknown): value is SystemListTitle {
  return typeof value === "string" && (SYSTEM_LIST_TITLES as readonly string[]).includes(value);
}
export function systemListTitle(value: unknown): SystemListTitle | undefined {
  if (isSystemListTitle(value)) return value;
  return typeof value === "string" ? SYSTEM_LIST_API_TITLES[value] : undefined;
}
export function isCanonicalSystemList(list: { title?: string; name?: string; is_default?: boolean }) {
  return list.is_default === true && isSystemListTitle(list.title ?? list.name);
}
/** Consumer-side normalization: other query functions can populate the shared cache. */
export function systemListDestinations<T extends {
  id: string; title?: string; name?: string; is_default?: boolean;
}>(lists: readonly T[]): Array<{
  id: string; title: SystemListTitle; name?: string; is_default?: boolean; is_private?: boolean;
}> {
  return SYSTEM_LIST_TITLES.map(title => {
    const existing = lists.find(list => list.is_default === true && (list.title ?? list.name) === title);
    return existing ? { ...existing, title } :
      { id: `__placeholder_${title}`, title, is_default: true, is_private: false };
  });
}
