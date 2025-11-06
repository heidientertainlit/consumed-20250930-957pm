import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
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

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  session: any;
  disabled?: boolean;
  testId?: string;
  autoFocus?: boolean;
}

export default function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  session,
  disabled,
  testId,
  autoFocus,
}: MentionInputProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

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
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentions(true);
        setCursorPosition(lastAtIndex);
        
        // Filter friends based on query
        const filtered = friends.filter((f) => {
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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentions || filteredFriends.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < filteredFriends.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (showMentions) {
        e.preventDefault();
        insertMention(filteredFriends[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowMentions(false);
    }
  };

  // Insert selected mention
  const insertMention = (friend: Friend) => {
    const username = friend.friend.user_name;
    const textBefore = value.substring(0, cursorPosition);
    const textAfter = value.substring(inputRef.current?.selectionStart || 0);
    
    const newValue = `${textBefore}@${username} ${textAfter}`;
    onChange(newValue);
    setShowMentions(false);
    
    // Set cursor position after mention
    setTimeout(() => {
      const newCursorPos = textBefore.length + username.length + 2;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      inputRef.current?.focus();
    }, 0);
  };

  const getDisplayName = (friend: Friend) => {
    const fullName = `${friend.friend.first_name || ""} ${friend.friend.last_name || ""}`.trim();
    return fullName || friend.friend.user_name || "Unknown User";
  };

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        data-testid={testId}
        autoFocus={autoFocus}
      />

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
    </div>
  );
}
