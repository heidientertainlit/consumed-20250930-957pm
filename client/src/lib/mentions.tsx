import { Link } from "wouter";
import { MENTION_PATTERN } from "./mention-constants";

/**
 * Parse text and render @mentions as clickable links
 * Only matches @username when @ is at start or preceded by whitespace
 */
export function renderMentions(text: string) {
  // Use centralized pattern to avoid drift
  const pattern = new RegExp(MENTION_PATTERN);
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const fullMatch = match[0]; // e.g., " @username", ":@username", "@username"
    const delimiter = match[1]; // Delimiter or empty string (start-of-line)
    const username = match[2]; // The username
    const matchStart = match.index;

    // Add text before this match
    if (matchStart > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, matchStart)}</span>);
    }

    // Add the delimiter if there was one
    if (delimiter) {
      parts.push(<span key={`delim-${matchStart}`}>{delimiter}</span>);
    }

    // Add the mention link
    parts.push(
      <Link
        key={`mention-${matchStart}`}
        href={`/user/${username}`}
        className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
        data-testid={`link-mention-${username}`}
      >
        @{username}
      </Link>
    );

    lastIndex = matchStart + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : <span>{text}</span>;
}

/**
 * Extract all @mentions from text
 * Only extracts mentions with valid delimiters (not in emails/URLs)
 */
export function extractMentions(text: string): string[] {
  const mentions: string[] = [];
  const pattern = new RegExp(MENTION_PATTERN);
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    mentions.push(match[2]); // Group 2 is the username (group 1 is delimiter)
  }
  
  return mentions;
}
