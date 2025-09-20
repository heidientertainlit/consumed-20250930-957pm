import type { Express } from 'express';
import { validateSupabaseToken, type AuthenticatedRequest } from './middleware/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerRoutes(app: Express) {
  
  // List sharing routes (requires authentication)
  app.get('/api/lists/public', async (req, res) => {
    try {
      const { data: lists, error } = await supabase
        .from('lists')
        .select(`
          *,
          list_items (*)
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(lists);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch public lists' });
    }
  });

  // Get user's lists (requires authentication)
  app.get('/api/users/:userId/lists', validateSupabaseToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own lists
      if (req.user?.id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: lists, error } = await supabase
        .from('lists')
        .select(`
          *,
          list_items (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(lists);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user lists' });
    }
  });

  // Create new list (requires authentication)
  app.post('/api/lists', validateSupabaseToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { title, description, visibility = 'private' } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const { data: list, error } = await supabase
        .from('lists')
        .insert({
          user_id: req.user!.id,
          title,
          description,
          visibility,
          is_default: false,
          is_pinned: false,
          is_private: visibility === 'private'
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json(list);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create list' });
    }
  });

  // Update list visibility (requires authentication)
  app.patch('/api/lists/:listId/visibility', validateSupabaseToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { listId } = req.params;
      const { visibility } = req.body;

      if (!['public', 'private'].includes(visibility)) {
        return res.status(400).json({ error: 'Invalid visibility value' });
      }

      // Ensure user owns the list
      const { data: list, error: fetchError } = await supabase
        .from('lists')
        .select('user_id')
        .eq('id', listId)
        .single();

      if (fetchError || !list) {
        return res.status(404).json({ error: 'List not found' });
      }

      if (list.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: updatedList, error } = await supabase
        .from('lists')
        .update({ 
          visibility, 
          is_private: visibility === 'private' 
        })
        .eq('id', listId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(updatedList);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update list visibility' });
    }
  });

  // Add item to list (requires authentication)
  app.post('/api/lists/:listId/items', validateSupabaseToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { listId } = req.params;
      const { title, description, externalId, externalSource, mediaType, imageUrl, rating } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Ensure user owns the list
      const { data: list, error: fetchError } = await supabase
        .from('lists')
        .select('user_id')
        .eq('id', listId)
        .single();

      if (fetchError || !list) {
        return res.status(404).json({ error: 'List not found' });
      }

      if (list.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { data: item, error } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          user_id: req.user!.id,
          title,
          description,
          external_id: externalId,
          external_source: externalSource,
          media_type: mediaType,
          image_url: imageUrl,
          rating
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add item to list' });
    }
  });
}