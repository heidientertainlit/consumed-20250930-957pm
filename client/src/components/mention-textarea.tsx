import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { User, Film, Tv, BookOpen, Music, Gamepad2 } from "lucide-react";
import { MENTION_TRIGGER_PATTERN } from "@/lib/mention-constants";

interface Friend {
  id: string;
  friend: {
    id: string;
    user_name: string;
    first_name: string | null;
    last_name: string | null;
  };
}

interface MediaItem {
  title: string;
  type: string;
  creator: string;
  image: string;
  external_id: string;
  external_source: string;
  description?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  session: any;
  maxLength?: number;
  disabled?: boolean;
  testId?: string;
  minHeight?: string;
  onMediaSelect?: (media: MediaItem) => void;
}

export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  session,
  maxLength,
  disabled,
  testId,
  minHeight = "120px",
  onMediaSelect,
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [mediaResults, setMediaResults] = useState<MediaItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch friends when component mounts
  useEffect(() => {
    const fetchFriends = async () => {
      if (!session?.access_token) return;

      try {
        const response = await fetch(
          "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: "getFriends" }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setFriends(data.friends || []);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
      }
    };

    fetchFriends();
  }, [session]);

  // Detect @ mention and filter friends
  useEffect(() => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const lastPlusIndex = textBeforeCursor.lastIndexOf("+");

    // Prioritize the most recent trigger (@ or +)
    if (lastPlusIndex > lastAtIndex) {
      // + is more recent, hide mentions
      setShowMentions(false);
      return;
    }

    if (lastAtIndex !== -1) {
      // Check if @ trigger pattern matches (at start or after whitespace/punctuation)
      const textUpToAndIncludingAt = textBeforeCursor.substring(0, lastAtIndex + 1);
      const isValidTrigger = MENTION_TRIGGER_PATTERN.test(textUpToAndIncludingAt);
      
      if (!isValidTrigger) {
        setShowMentions(false);
        return;
      }
      
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's a space after @ (which means mention is complete)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentions(true);
        setShowMedia(false);
        setCursorPosition(lastAtIndex);
        
        // Filter friends based on query
        const filtered = friends.filter((f) => {
          if (!f?.friend) return false;
          const displayName = `${f.friend.first_name || ""} ${f.friend.last_name || ""}`.trim();
          const username = f.friend.user_name || "";
          return (
            displayName.toLowerCase().includes(textAfterAt.toLowerCase()) ||
            username.toLowerCase().includes(textAfterAt.toLowerCase())
          );
        });
        
        setFilteredFriends(filtered);
        setSelectedIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [value, friends]);

  // Detect + for media search
  useEffect(() => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastPlusIndex = textBeforeCursor.lastIndexOf("+");
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    // Prioritize the most recent trigger
    if (lastAtIndex > lastPlusIndex) {
      // @ is more recent, hide media
      setShowMedia(false);
      return;
    }

    if (lastPlusIndex !== -1) {
      // Check if + is at start or after whitespace (word boundary)
      const textUpToAndIncludingPlus = textBeforeCursor.substring(0, lastPlusIndex + 1);
      const isValidTrigger = /^(.*[\s\n]|^)\+$/.test(textUpToAndIncludingPlus);
      
      if (!isValidTrigger) {
        setShowMedia(false);
        return;
      }
      
      const textAfterPlus = textBeforeCursor.substring(lastPlusIndex + 1);
      
      // Check if there's a space after + (which means search is complete)
      if (!textAfterPlus.includes(" ") && !textAfterPlus.includes("\n")) {
        const query = textAfterPlus.trim();
        setMediaQuery(query);
        setCursorPosition(lastPlusIndex);
        
        // Only search if query has at least 2 characters
        if (query.length >= 2) {
          setShowMedia(true);
          setShowMentions(false);
          setIsSearchingMedia(true);
          
          // Debounce the search
          const timeoutId = setTimeout(async () => {
            try {
              const response = await fetch(
                'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search',
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ query }),
                }
              );
              
              if (response.ok) {
                const data = await response.json();
                setMediaResults(data.results || []);
              }
            } catch (error) {
              console.error('Media search error:', error);
            } finally {
              setIsSearchingMedia(false);
            }
          }, 300);
          
          return () => clearTimeout(timeoutId);
        } else {
          setShowMedia(false);
          setMediaResults([]);
        }
      } else {
        setShowMedia(false);
      }
    } else {
      setShowMedia(false);
    }
  }, [value, session]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isShowingDropdown = showMentions || showMedia;
    const items = showMentions ? filteredFriends : mediaResults;
    
    if (!isShowingDropdown || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < items.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (showMentions) {
        insertMention(filteredFriends[selectedIndex]);
      } else if (showMedia) {
        selectMedia(mediaResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowMentions(false);
      setShowMedia(false);
    }
  };

  // Insert selected mention
  const insertMention = (friend: Friend) => {
    const username = friend.friend.user_name;
    const textBefore = value.substring(0, cursorPosition);
    const textAfter = value.substring(textareaRef.current?.selectionStart || 0);
    
    const newValue = `${textBefore}@${username} ${textAfter}`;
    onChange(newValue);
    setShowMentions(false);
    
    // Set cursor position after mention
    setTimeout(() => {
      const newCursorPos = textBefore.length + username.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    }, 0);
  };

  // Select media and notify parent
  const selectMedia = (media: MediaItem) => {
    if (!media || !onMediaSelect) return;
    
    // Remove the + and search query from the text
    const textBefore = value.substring(0, cursorPosition);
    const textAfter = value.substring(textareaRef.current?.selectionStart || 0);
    
    // Just remove the + trigger and query, leaving a space
    const newValue = `${textBefore} ${textAfter}`;
    onChange(newValue);
    setShowMedia(false);
    
    // Call parent callback to attach media
    onMediaSelect(media);
    
    // Set cursor position after space
    setTimeout(() => {
      const newCursorPos = textBefore.length + 1;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const getDisplayName = (friend: Friend) => {
    if (!friend?.friend) return "Unknown User";
    const fullName = `${friend.friend.first_name || ""} ${friend.friend.last_name || ""}`.trim();
    return fullName || friend.friend.user_name || "Unknown User";
  };

  const getMediaIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'movie':
        return <Film size={16} className="text-blue-600" />;
      case 'tv':
      case 'series':
        return <Tv size={16} className="text-purple-600" />;
      case 'book':
        return <BookOpen size={16} className="text-green-600" />;
      case 'music':
      case 'album':
      case 'track':
        return <Music size={16} className="text-pink-600" />;
      case 'game':
        return <Gamepad2 size={16} className="text-orange-600" />;
      default:
        return <Film size={16} className="text-gray-600" />;
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:outline-none ${className || ''}`}
        maxLength={maxLength}
        disabled={disabled}
        data-testid={testId}
        style={{ minHeight }}
      />
      
      {/* Character count (if maxLength is provided) */}
      {maxLength && (
        <div className="absolute bottom-3 right-3 text-sm text-gray-400 pointer-events-none">
          {value.length}/{maxLength}
        </div>
      )}

      {/* Mention dropdown */}
      {showMentions && filteredFriends.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 w-full"
          data-testid="mention-dropdown"
        >
          {filteredFriends.map((friend, index) => (
            <div
              key={friend.friend.id}
              onClick={() => insertMention(friend)}
              className={`flex items-center space-x-3 p-3 cursor-pointer transition-colors ${
                index === selectedIndex ? "bg-purple-50" : "hover:bg-gray-50"
              }`}
              data-testid={`mention-option-${friend.friend.id}`}
            >
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">
                  {getDisplayName(friend)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  @{friend.friend.user_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media dropdown */}
      {showMedia && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50 w-full"
          data-testid="media-dropdown"
        >
          {isSearchingMedia ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Searching...
            </div>
          ) : mediaResults.length > 0 ? (
            mediaResults.map((media, index) => (
              <div
                key={`${media.external_source}-${media.external_id}`}
                onClick={() => selectMedia(media)}
                className={`flex items-start space-x-3 p-3 cursor-pointer transition-colors ${
                  index === selectedIndex ? "bg-purple-50" : "hover:bg-gray-50"
                }`}
                data-testid={`media-option-${media.external_id}`}
              >
                {media.image ? (
                  <img
                    src={media.image}
                    alt={media.title}
                    className="w-12 h-16 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                    {getMediaIcon(media.type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {media.title}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {media.type}
                  </p>
                  {media.creator && (
                    <p className="text-xs text-gray-500 truncate">
                      {media.creator}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">
              No media found. Try a different search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
