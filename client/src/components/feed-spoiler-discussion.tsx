import React, { createContext, useContext, useState } from "react";

interface SpoilerDiscussionState {
  containsSpoilers: boolean;
  revealed: boolean;
  reveal: () => void;
}

const SpoilerDiscussionContext = createContext<SpoilerDiscussionState | null>(null);

/** One reveal applies only to this post and its actual reply thread. */
export function FeedSpoilerDiscussion({
  discussionId,
  content,
  containsSpoilers = false,
  children,
}: {
  discussionId: string;
  content?: string;
  containsSpoilers?: boolean;
  children: React.ReactNode;
}) {
  const scopeKey = JSON.stringify([discussionId, content, containsSpoilers]);
  const [revealedScope, setRevealedScope] = useState<string | null>(null);

  return (
    <SpoilerDiscussionContext.Provider value={{
      containsSpoilers,
      revealed: revealedScope === scopeKey,
      reveal: () => setRevealedScope(scopeKey),
    }}>
      {children}
    </SpoilerDiscussionContext.Provider>
  );
}

export function useFeedSpoilerDiscussion() {
  return useContext(SpoilerDiscussionContext);
}
