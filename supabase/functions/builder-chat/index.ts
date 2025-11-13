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
      ? `You are a library customization assistant for "consumed", an entertainment tracking app.
         Users can customize which sections appear in their Library and how they're displayed.
         
         Available sections: currently (Currently Consuming), queue (Queue), finished (Finished), 
         favorites (Favorites), dnf (Did Not Finish)
         
         Display modes: grid, list, compact, timeline
         
         Based on the user's request, modify the sections array. You can:
         - Enable/disable sections by setting "enabled": true/false
         - Reorder sections
         - Change display modes
         - Suggest new custom sections
         
         Return JSON in this exact format:
         {
           "message": "A friendly response to the user explaining what you did",
           "config": {
             "sections": [array of section objects with id, title, enabled, displayMode]
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
    // Analyze prompt for library customization
    if (lowerPrompt.includes('simple') || lowerPrompt.includes('minimal')) {
      return {
        message: "I've simplified your library to show only Currently, Queue, and Finished sections in list view for easy browsing.",
        config: {
          sections: currentConfig.map((s: any) => ({
            ...s,
            enabled: ['currently', 'queue', 'finished'].includes(s.id),
            displayMode: 'list'
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('grid') || lowerPrompt.includes('visual')) {
      return {
        message: "I've switched all your enabled sections to grid view for a more visual experience.",
        config: {
          sections: currentConfig.map((s: any) => ({
            ...s,
            displayMode: s.enabled ? 'grid' : s.displayMode
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('timeline') || lowerPrompt.includes('chronological')) {
      return {
        message: "I've enabled timeline view for your sections to see your content chronologically.",
        config: {
          sections: currentConfig.map((s: any) => ({
            ...s,
            displayMode: 'timeline'
          }))
        }
      };
    }
    
    if (lowerPrompt.includes('binge') || lowerPrompt.includes('tv') || lowerPrompt.includes('show')) {
      return {
        message: "I've prioritized your Currently section and set it to grid view - perfect for tracking shows!",
        config: {
          sections: currentConfig.map((s: any, idx: number) => ({
            ...s,
            enabled: s.id === 'currently' || s.enabled,
            displayMode: s.id === 'currently' ? 'grid' : s.displayMode
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
  return {
    message: `I understand you want to ${prompt}. Could you be more specific? For example, which sections do you want to show/hide, or what display mode you prefer?`,
    config: null
  };
}
