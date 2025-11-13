import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BuilderRequest {
  prompt: string;
  context: 'library' | 'tracking';
  currentConfig: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { prompt, context, currentConfig }: BuilderRequest = await req.json();

    // Check if Anthropic API key is available
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!anthropicKey) {
      // Fallback: Smart mock responses based on prompt analysis
      const mockResponse = generateMockResponse(prompt, context, currentConfig);
      return new Response(
        JSON.stringify(mockResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Anthropic API
    const systemPrompt = context === 'library'
      ? `You are a list organization assistant for "consumed", an entertainment tracking app.
         Users can configure how ALL their lists work system-wide (not per-list customization).
         
         Configuration structure:
         - listLayout: { defaultLayout: 'grid' | 'list' | 'compact' }
         - listFeatures: array of features with id, label, description, enabled
         
         Available features:
         - progress: Progress Tracker (show progress bars)
         - notes: Notes & Reviews (enable adding notes)
         - collaborators: Invite Collaborators (allow others to contribute)
         - privacy: Privacy Controls (set lists as public/private)
         - covers: Cover Images (display cover art)
         - tags: Custom Tags (organize with tags)
         
         Based on the user's request, modify the configuration. You can:
         - Change the default layout (grid/list/compact)
         - Enable/disable features globally across all lists
         
         Return JSON in this exact format:
         {
           "message": "A friendly response to the user explaining what you did",
           "config": {
             "listLayout": { "defaultLayout": "grid" | "list" | "compact" },
             "listFeatures": [array of feature objects with id, label, description, enabled]
           }
         }`
      : `You are a tracking customization assistant for "consumed", an entertainment tracking app.
         Users can customize which fields appear when they log media consumption.
         
         Available fields: rating, notes, progress, startDate, finishDate, tags
         
         Based on the user's request, modify the fields array. You can:
         - Enable/disable fields by setting "enabled": true/false
         - Suggest new custom fields
         
         Return JSON in this exact format:
         {
           "message": "A friendly response to the user explaining what you did",
           "config": {
             "fields": [array of field objects with id, label, enabled]
           }
         }`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-4.1-sonnet-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Current configuration: ${JSON.stringify(currentConfig, null, 2)}
          
User request: ${prompt}

Please generate the updated configuration.`
        }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;
    
    // Parse the JSON response
    const parsedResponse = JSON.parse(aiResponse);

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in builder-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: "Sorry, I encountered an error. Please try again!"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Smart mock response generator for when API key is not available
function generateMockResponse(prompt: string, context: string, currentConfig: any) {
  const lowerPrompt = prompt.toLowerCase();
  
  if (context === 'library') {
    const { listLayout, listFeatures } = currentConfig;
    
    // Analyze prompt for list organization
    if (lowerPrompt.includes('compact') || lowerPrompt.includes('dense') || lowerPrompt.includes('text')) {
      return {
        message: "I've switched all your lists to compact view for a dense, text-only display.",
        config: {
          listLayout: { defaultLayout: 'compact' },
          listFeatures: listFeatures
        }
      };
    }
    
    if (lowerPrompt.includes('grid') || lowerPrompt.includes('visual') || lowerPrompt.includes('cards')) {
      return {
        message: "I've switched all your lists to grid view for a more visual, card-based experience.",
        config: {
          listLayout: { defaultLayout: 'grid' },
          listFeatures: listFeatures
        }
      };
    }
    
    if (lowerPrompt.includes('list view') || lowerPrompt.includes('detailed rows')) {
      return {
        message: "I've switched all your lists to list view for detailed rows with metadata.",
        config: {
          listLayout: { defaultLayout: 'list' },
          listFeatures: listFeatures
        }
      };
    }
    
    if (lowerPrompt.includes('progress') && (lowerPrompt.includes('off') || lowerPrompt.includes('disable') || lowerPrompt.includes('hide'))) {
      return {
        message: "I've turned off progress trackers across all your lists.",
        config: {
          listLayout: listLayout,
          listFeatures: listFeatures.map((f: any) => ({
            ...f,
            enabled: f.id === 'progress' ? false : f.enabled
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('cover') && (lowerPrompt.includes('off') || lowerPrompt.includes('hide') || lowerPrompt.includes('no'))) {
      return {
        message: "I've turned off cover images across all your lists for a cleaner look.",
        config: {
          listLayout: listLayout,
          listFeatures: listFeatures.map((f: any) => ({
            ...f,
            enabled: f.id === 'covers' ? false : f.enabled
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('collaborat') || lowerPrompt.includes('invite') || lowerPrompt.includes('share')) {
      return {
        message: "I've enabled collaboration features so you can invite others to contribute to your lists!",
        config: {
          listLayout: listLayout,
          listFeatures: listFeatures.map((f: any) => ({
            ...f,
            enabled: f.id === 'collaborators' ? true : f.enabled
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('simple') || lowerPrompt.includes('minimal')) {
      return {
        message: "I've simplified your lists - just the essentials with minimal features enabled.",
        config: {
          listLayout: { defaultLayout: 'compact' },
          listFeatures: listFeatures.map((f: any) => ({
            ...f,
            enabled: ['privacy', 'covers'].includes(f.id)
          }))
        }
      };
    }
  } else {
    // Tracking context
    if (lowerPrompt.includes('simple') || lowerPrompt.includes('minimal') || lowerPrompt.includes('just') || lowerPrompt.includes('only')) {
      return {
        message: "I've simplified tracking to just the essentials - progress tracking only. Quick and easy!",
        config: {
          fields: currentConfig.map((f: any) => ({
            ...f,
            enabled: f.required || f.id === 'progress'
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('everything') || lowerPrompt.includes('all') || lowerPrompt.includes('detailed')) {
      return {
        message: "I've enabled all tracking fields so you can capture every detail about your media consumption.",
        config: {
          fields: currentConfig.map((f: any) => ({
            ...f,
            enabled: true
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('rating') && !lowerPrompt.includes('no rating')) {
      return {
        message: "I've enabled ratings and notes so you can share your thoughts on what you consume.",
        config: {
          fields: currentConfig.map((f: any) => ({
            ...f,
            enabled: f.required || ['rating', 'notes'].includes(f.id)
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('mood') || lowerPrompt.includes('emotion') || lowerPrompt.includes('feel')) {
      return {
        message: "Great idea! I've enabled tags so you can track moods. You can add custom tags like 'happy', 'thoughtful', etc.",
        config: {
          fields: currentConfig.map((f: any) => ({
            ...f,
            enabled: f.enabled || f.id === 'tags'
          }))
        }
      };
    }
  }
  
  // Default response
  if (context === 'library') {
    return {
      message: `I understand you want to ${prompt}. Could you be more specific? For example, do you want to change the default layout (grid/list/compact), or enable/disable specific features like progress trackers or cover images?`,
      config: null
    };
  } else {
    return {
      message: `I understand you want to ${prompt}. Could you be more specific? For example, which tracking options do you want to enable or disable?`,
      config: null
    };
  }
}
