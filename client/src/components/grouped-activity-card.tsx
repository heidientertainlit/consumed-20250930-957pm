import { useState } from "react";
import { Link } from "wouter";
import { Users, Dices, ChevronDown, Film, Tv, BookOpen, Music, Gamepad2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GroupedUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  postId?: string;
}

const formatUsername = (username: string): string => {
  let clean = username;
  if (clean.includes('+')) {
    clean = clean.split('+').pop() || clean;
  }
  clean = clean.replace(/\d+$/, '');
  clean = clean.replace(/[@_.-]/g, ' ');
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
  return clean.split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'User';
};

const getAvatarInitial = (displayName?: string, username?: string): string => {
  if (displayName && displayName.trim() && displayName !== username) {
    return displayName.charAt(0).toUpperCase();
  }
  
  if (username) {
    const formatted = formatUsername(username);
    return formatted.charAt(0).toUpperCase();
  }
  
  return '?';
};

const getDisplayName = (displayName?: string, username?: string): string => {
  if (displayName && displayName.trim() && displayName !== username) {
    return displayName;
  }
  
  if (username) {
    return formatUsername(username);
  }
  
  return 'Unknown';
};

interface GroupedMedia {
  id: string;
  title: string;
  imageUrl?: string;
  mediaType: string;
  externalId: string;
  externalSource: string;
}

interface GroupedActivityCardProps {
  media: GroupedMedia;
  users: GroupedUser[];
  listType: string;
  onBetClick?: (userId: string, postId: string, media: GroupedMedia) => void;
  timestamp?: string;
}

const getMediaIcon = (mediaType: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'movie': return <Film size={14} className="text-purple-500" />;
    case 'tv': return <Tv size={14} className="text-blue-500" />;
    case 'book': return <BookOpen size={14} className="text-amber-600" />;
    case 'music': return <Music size={14} className="text-green-500" />;
    case 'game': return <Gamepad2 size={14} className="text-orange-500" />;
    case 'podcast': return <Headphones size={14} className="text-cyan-500" />;
    default: return <Film size={14} className="text-gray-500" />;
  }
};

const getListTypeLabel = (_listType: string) => {
  return 'a list';
};

export default function GroupedActivityCard({
  media,
  users,
  listType,
  onBetClick,
  timestamp
}: GroupedActivityCardProps) {
  const [showAllUsers, setShowAllUsers] = useState(false);
  
  const uniqueUsers = users.filter((user, index, self) => 
    index === self.findIndex(u => u.id === user.id)
  );
  
  // Don't render grouped card if only 1 unique user - return null
  if (uniqueUsers.length < 2) {
    return null;
  }
  
  const displayedUsers = showAllUsers ? uniqueUsers : uniqueUsers.slice(0, 3);
  const remainingCount = uniqueUsers.length - 3;
  const showBetButton = listType?.toLowerCase() === 'want_to' || 
                        listType?.toLowerCase() === 'currently' ||
                        listType?.toLowerCase().includes('want') ||
                        listType?.toLowerCase().includes('currently');

  const usersWithPostIds = uniqueUsers.filter(u => u.postId);

  return (
    <div className="bg-gradient-to-r from-[#1a1a2e] via-[#2d1f4e] to-[#1a1a2e] rounded-2xl border border-purple-900/50 p-4 shadow-lg" data-testid={`grouped-activity-${media.id}`}>
      <div className="flex gap-3">
        <Link href={`/media/${media.mediaType}/${media.externalSource}/${media.externalId}`}>
          <div className="w-16 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/50 to-purple-800/30 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity ring-1 ring-purple-500/30">
            {media.imageUrl ? (
              <img 
                src={media.imageUrl} 
                alt={media.title} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  {getMediaIcon(media.mediaType)}
                </div>
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-purple-200/80 mb-1">
            <Users size={14} className="text-purple-400" />
            <span className="font-medium text-white">{uniqueUsers.length} friend{uniqueUsers.length !== 1 ? 's' : ''}</span>
            <span>added to {getListTypeLabel(listType)}</span>
          </div>

          <Link href={`/media/${media.mediaType}/${media.externalSource}/${media.externalId}`}>
            <h3 className="font-semibold text-white truncate hover:text-purple-300 cursor-pointer">
              {media.title}
            </h3>
          </Link>

          <div className="flex items-center gap-1 mt-1">
            {getMediaIcon(media.mediaType)}
            <span className="text-xs text-purple-200/60 capitalize">{media.mediaType}</span>
          </div>

          <div className="flex items-center gap-1 mt-3">
            {displayedUsers.map((user) => (
              <Link key={user.id} href={`/user/${user.id}`}>
                <Avatar className="w-7 h-7 border-2 border-purple-900/50 -ml-2 first:ml-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all">
                  <AvatarImage src={user.avatar} alt={getDisplayName(user.displayName, user.username)} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                    {getAvatarInitial(user.displayName, user.username)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ))}
            {remainingCount > 0 && !showAllUsers && (
              <button 
                onClick={() => setShowAllUsers(true)}
                className="w-7 h-7 rounded-full bg-purple-900/50 border-2 border-purple-900/50 -ml-2 flex items-center justify-center text-xs font-medium text-purple-200 hover:bg-purple-800/50 transition-colors"
              >
                +{remainingCount}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            {displayedUsers.slice(0, 2).map((user, index) => (
              <span key={user.id} className="text-xs text-purple-200/70">
                {getDisplayName(user.displayName, user.username)}{index < Math.min(displayedUsers.length - 1, 1) ? ',' : ''}
              </span>
            ))}
            {uniqueUsers.length > 2 && (
              <span className="text-xs text-purple-200/70">
                +{uniqueUsers.length - 2} more
              </span>
            )}
          </div>
        </div>
      </div>

      {showBetButton && onBetClick && usersWithPostIds.length > 0 && (
        <div className="mt-4 pt-3 border-t border-purple-900/50">
          {usersWithPostIds.length === 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBetClick(usersWithPostIds[0].id, usersWithPostIds[0].postId!, media)}
              className="w-full border-purple-500/50 text-purple-200 bg-purple-900/30 hover:bg-purple-800/50 hover:border-purple-400/50 rounded-full"
              data-testid="button-bet-on-reactions"
            >
              <Dices size={16} className="mr-2" />
              Bet on {getDisplayName(usersWithPostIds[0].displayName, usersWithPostIds[0].username)}'s reaction
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-500/50 text-purple-200 bg-purple-900/30 hover:bg-purple-800/50 hover:border-purple-400/50 rounded-full"
                  data-testid="button-bet-on-reactions"
                >
                  <Dices size={16} className="mr-2" />
                  Bet on their reactions
                  <ChevronDown size={16} className="ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                {usersWithPostIds.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => onBetClick(user.id, user.postId!, media)}
                    className="cursor-pointer"
                    data-testid={`bet-option-${user.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={user.avatar} alt={getDisplayName(user.displayName, user.username)} />
                        <AvatarFallback className="text-xs bg-gradient-to-br from-purple-100 to-blue-100 text-purple-700">
                          {getAvatarInitial(user.displayName, user.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{getDisplayName(user.displayName, user.username)}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {timestamp && (
        <div className="text-xs text-purple-300/60 mt-2 text-right">
          {new Date(timestamp).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
