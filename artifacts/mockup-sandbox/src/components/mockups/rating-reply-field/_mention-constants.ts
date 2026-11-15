/**
 * Centralized mention constants to ensure consistency across the app
 * 
 * Username pattern supports: letters, numbers, dots, hyphens, underscores
 * Must match Supabase user_name validation
 */

// Regex pattern for extracting mentions from text
// Matches @username where username can contain: a-z, A-Z, 0-9, dots, hyphens, underscores
// Uses whitelist approach: @ must be at start OR preceded by allowed punctuation/whitespace
// Allows: "@alex", " @alex", ",@alex", "(@alex", "FYI:@alex", "!@alex", etc.
// Blocks: "user@alex", "http://@alex", "?ref=@alex", "&id=@alex"
export const MENTION_PATTERN = /(^|[\s,;:!?(){}\[\]"'<>\-])@([\w.-]+)/g;

// Regex for detecting if @ should trigger autocomplete
// Triggers if @ is at start OR preceded by whitespace/punctuation (same as mention pattern)
// This ensures autocomplete appears in all contexts where mentions are valid
export const MENTION_TRIGGER_PATTERN = /(^|[\s,;:!?(){}\[\]"'<>\-])@$/;
