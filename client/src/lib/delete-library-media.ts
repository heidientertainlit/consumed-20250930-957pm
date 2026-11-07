import type { SupabaseClient } from '@supabase/supabase-js';

export type LibraryDeletion = {
  deleted_list_item_ids: string[];
  deleted_items: number;
  deleted_posts: number;
  deleted_ratings: number;
  deleted_progress_events: number;
};

export async function deleteLibraryMedia(
  client: Pick<SupabaseClient, 'rpc'>,
  itemId: string,
): Promise<LibraryDeletion> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) {
    throw new Error('This item cannot be safely identified. Refresh and try again.');
  }
  const { data, error } = await client.rpc('delete_own_library_media', { p_item_id: itemId });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Deletion is not available yet. Nothing was removed.');
    }
    throw new Error(error.message || 'Could not delete media. Please try again.');
  }
  const result = data as LibraryDeletion | null;
  if (!result || !Array.isArray(result.deleted_list_item_ids)
    || !result.deleted_list_item_ids.includes(itemId)
    || result.deleted_items !== result.deleted_list_item_ids.length
    || !Number.isInteger(result.deleted_items) || result.deleted_items < 1) {
    throw new Error('Deletion could not be confirmed. Refresh your library before trying again.');
  }
  return result;
}
