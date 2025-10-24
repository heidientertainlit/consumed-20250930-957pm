import { useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface User {
  id: string;
  user_name: string;
  display_name?: string;
  email?: string;
}

interface UserSearchProps {
  onSelectUser: (user: User) => void;
  excludeUserIds?: string[];
  placeholder?: string;
}

export default function UserSearch({ onSelectUser, excludeUserIds = [], placeholder = "Search for friends..." }: UserSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { session } = useAuth();

  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['user-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      if (!session?.access_token) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-friendships?action=search&query=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('User search failed');
        return [];
      }

      const data = await response.json();
      return (data.users || []).filter((user: User) => !excludeUserIds.includes(user.id));
    },
    enabled: searchTerm.length >= 2 && !!session?.access_token,
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-user-search"
        />
      </div>

      {isLoading && searchTerm.length >= 2 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin text-purple-600" size={24} />
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {searchResults.map((user: User) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              data-testid={`user-result-${user.id}`}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-purple-600 text-white">
                    {(user.display_name || user.user_name).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900" data-testid={`text-display-name-${user.id}`}>
                    {user.display_name || user.user_name}
                  </p>
                  <p className="text-sm text-gray-600" data-testid={`text-username-${user.id}`}>
                    @{user.user_name}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onSelectUser(user);
                  setSearchTerm("");
                }}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid={`button-add-user-${user.id}`}
              >
                <UserPlus size={16} className="mr-1" />
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {searchTerm.length >= 2 && !isLoading && searchResults.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No users found</p>
        </div>
      )}

      {searchTerm.length > 0 && searchTerm.length < 2 && (
        <div className="text-center py-2">
          <p className="text-xs text-gray-400">Type at least 2 characters to search</p>
        </div>
      )}
    </div>
  );
}
