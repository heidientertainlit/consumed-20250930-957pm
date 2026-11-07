import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type DeleteLibraryMediaDialogProps = {
  item: { id: string; title: string } | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteLibraryMediaDialog({
  item, pending, error, onCancel, onConfirm,
}: DeleteLibraryMediaDialogProps) {
  return (
    <AlertDialog open={!!item} onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {item?.title} from My Media?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes this title from all your library lists, including Favorites,
            and deletes your tracking history, rating, and posts or reviews about it.
            Comments and reactions attached to those posts are also removed.
            Other people&apos;s library entries and posts are not deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
            data-testid="confirm-delete-library-media"
          >
            {pending ? 'Deleting…' : 'Delete from My Media'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
