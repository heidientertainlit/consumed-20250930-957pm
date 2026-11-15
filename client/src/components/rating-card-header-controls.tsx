import {
  ChevronRight,
  Flag,
  MoreHorizontal,
  Forward,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RatingCardHeaderControlsProps {
  onReport?: () => void;
  onDelete?: () => void;
  onNext?: () => void;
  onShare: () => void;
}

export default function RatingCardHeaderControls({
  onReport,
  onDelete,
  onNext,
  onShare,
}: RatingCardHeaderControlsProps) {
  const hasModerationActions = Boolean(onReport || onDelete);

  return (
    <div className="absolute inset-x-1 top-1 z-10 flex items-start justify-between">
      {hasModerationActions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Review options"
              onClick={(event) => event.stopPropagation()}
              className="flex h-11 w-11 shrink-0 items-center justify-start pl-[13px] text-gray-500 transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <MoreHorizontal size={24} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={5}
            onClick={(event) => event.stopPropagation()}
            className="min-w-40 border-[#e8e1eb] bg-white text-[#362c3c]"
          >
            {onReport && (
              <DropdownMenuItem
                aria-label="Report review"
                onSelect={() => onReport()}
                className="min-h-11 cursor-pointer focus:bg-[#f5eff9] focus:text-[#56217d]"
              >
                <Flag size={16} aria-hidden="true" />
                <span>Report</span>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                aria-label="Delete post"
                onSelect={() => onDelete()}
                className="min-h-11 cursor-pointer text-[#a33d50] focus:bg-[#fff1f2] focus:text-[#942d42]"
              >
                <Trash2 size={16} aria-hidden="true" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span aria-hidden="true" className="h-11 w-11 shrink-0" />
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Share review"
          onClick={(event) => {
            event.stopPropagation();
            onShare();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-[#89909D] transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <Forward size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {onNext && (
          <button
            type="button"
            aria-label="Show another review"
            data-guest-allowed
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-[#89909D] transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <ChevronRight size={19} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
