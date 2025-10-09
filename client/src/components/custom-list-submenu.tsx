import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ChevronRight, Plus, List } from "lucide-react";
import CreateListDialog from "./create-list-dialog";
import { useAuth } from "@/lib/auth";

interface CustomListSubmenuProps {
  onSelectList: (listId: string, listTitle: string, isCustom: boolean) => void;
  disabled?: boolean;
}

interface UserList {
  id: string;
  title: string;
  isCustom?: boolean;
  isPrivate?: boolean;
}

export default function CustomListSubmenu({ onSelectList, disabled }: CustomListSubmenuProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={disabled} className="cursor-pointer">
          <List className="h-4 w-4 mr-2" />
          <span>Custom Lists</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          {isLoading ? (
            <DropdownMenuItem disabled className="text-sm text-gray-500">
              Loading...
            </DropdownMenuItem>
          ) : customLists.length > 0 ? (
            <>
              {customLists.map((list) => (
                <DropdownMenuItem
                  key={list.id}
                  onClick={() => onSelectList(list.id, list.title, true)}
                  className="cursor-pointer"
                  data-testid={`menu-custom-list-${list.id}`}
                >
                  {list.title}
                  {list.isPrivate && <span className="ml-2 text-xs text-gray-500">🔒</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : (
            <DropdownMenuItem disabled className="text-sm text-gray-500">
              No custom lists yet
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDialog(true);
            }}
            className="cursor-pointer text-purple-400 hover:text-purple-300"
            data-testid="menu-create-new-list"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New List
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
