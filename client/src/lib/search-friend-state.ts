export interface SearchRelationship {
  relationship_status?: string | null;
  relationship_direction?: string | null;
}

export function searchFriendLabel(person: SearchRelationship): string {
  if (person.relationship_status === "accepted") return "Friend";
  if (person.relationship_status === "pending") {
    return person.relationship_direction === "incoming" ? "Wants to connect" : "Requested";
  }
  return "Add";
}

/** Only call after the server confirms that the request was sent. */
export function markSearchFriendRequested<T extends SearchRelationship & { id: string }>(
  people: T[] | undefined,
  friendId: string,
): T[] | undefined {
  return people?.map(person => person.id === friendId
    ? { ...person, relationship_status: "pending", relationship_direction: "outgoing" }
    : person);
}