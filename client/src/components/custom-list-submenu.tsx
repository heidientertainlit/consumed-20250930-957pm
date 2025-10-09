import { useQuery } from "@tanstack/react-query";
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Plus, List } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface CustomListSubmenuProps {
  onSelectList: (listId: string, listTitle: string, isCustom: boolean) => void;
  onCreateList: () => void;
  disabled?: boolean;
}

interface UserList {
  id: string;
  title: string;
  isCustom?: boolean;
  isPrivate?: boolean;
}

export default function CustomListSubmenu({ onSelectList, onCreateList, disabled }: CustomListSubmenuProps) {
  const { session } = useAuth();

  // Fetch user's lists (includes both system and custom lists)
  const { data: listsData, isLoading } = useQuery<{ lists: UserList[] }>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media", {
        headers: {
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }

      return response.json();
    },
    enabled: !!session,
  });

  // Filter to only custom lists
  const customLists = listsData?.lists?.filter(list => list.isCustom) || [];

  if (isLoading) {
    return (
      <DropdownMenuItem disabled className="text-sm text-gray-400">
        <List className="h-4 w-4 mr-2" />
        Loading custom lists...
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuLabel className="text-xs text-gray-400 font-semibold px-2 py-1.5">
        MY CUSTOM LISTS
      </DropdownMenuLabel>
      
      {customLists.length > 0 ? (
        <>
          {customLists.map((list) => (
            <DropdownMenuItem
              key={list.id}
              onClick={() => onSelectList(list.id, list.title, true)}
              disabled={disabled}
              className="cursor-pointer pl-4"
              data-testid={`menu-custom-list-${list.id}`}
            >
              <List className="h-4 w-4 mr-2 text-purple-400" />
              {list.title}
              {list.isPrivate && <span className="ml-2 text-xs">🔒</span>}
            </DropdownMenuItem>
          ))}
        </>
      ) : (
        <DropdownMenuItem disabled className="text-sm text-gray-500 pl-4 italic">
          No custom lists yet
        </DropdownMenuItem>
      )}
      
      <DropdownMenuItem
        onClick={onCreateList}
        disabled={disabled}
        className="cursor-pointer text-purple-400 hover:text-purple-300 pl-4 font-medium"
        data-testid="menu-create-new-list"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create New List
      </DropdownMenuItem>
      
      <DropdownMenuSeparator />
    </>
  );
}
