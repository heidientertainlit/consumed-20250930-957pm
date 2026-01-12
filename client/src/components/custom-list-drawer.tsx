import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { X, Folder, Check } from "lucide-react";

interface ListItem {
  id: string;
  title?: string;
  name?: string;
  is_default?: boolean;
}

interface CustomListDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lists: ListItem[];
  selectedListId: string;
  onSelectList: (listId: string) => void;
  mediaTitle?: string;
}

export function CustomListDrawer({
  isOpen,
  onOpenChange,
  lists,
  selectedListId,
  onSelectList,
  mediaTitle,
}: CustomListDrawerProps) {
  const customLists = lists.filter((l) => !l.is_default);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-white">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 my-3" />
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-lg font-semibold text-gray-900">Add to List</DrawerTitle>
          {mediaTitle && (
            <p className="text-sm text-gray-500">{mediaTitle}</p>
          )}
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-1 max-h-[60vh] overflow-y-auto bg-white">
          <button
            onClick={() => onOpenChange(false)}
            className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <X className="text-gray-500" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Cancel</p>
              <p className="text-sm text-gray-500">Go back</p>
            </div>
          </button>
          {customLists.map((list) => (
            <button
              key={list.id}
              onClick={() => {
                onSelectList(list.id);
                onOpenChange(false);
              }}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Folder className="text-purple-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{list.title || list.name}</p>
                <p className="text-sm text-gray-500">Custom list</p>
              </div>
              {selectedListId === list.id && (
                <Check size={20} className="text-purple-600" />
              )}
            </button>
          ))}
          {customLists.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No custom lists yet</p>
              <p className="text-sm">Create one in Collections</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
