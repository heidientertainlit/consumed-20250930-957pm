import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeServiceRole } from '../_shared/authorization.ts';
import { checkBlockingRelationship } from '../_shared/block-relationships.ts';
import {
  handleSendNotificationRequest,
  type SendNotificationDependencies,
} from '../_shared/send-notification-handler.ts';
import { loadLiveUser } from '../_shared/provider-ingestion-guard.ts';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || 'f3e5ce59-cb78-4f05-8d7b-511c45dc2c76';

async function sendOneSignalPush(userId: string, message: string, route: string): Promise<void> {
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY') || Deno.env.get('ONESIGNAL_API_KEY');
  if (!apiKey) {
    console.log('ONESIGNAL_REST_API_KEY not set — skipping push');
    return;
  }

  const body = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: [userId] },
    target_channel: 'push',
    headings: { en: 'Consumed' },
    contents: { en: message },
    data: { route },
    ios_badgeType: 'Increase',
    ios_badgeCount: 1,
  };

  try {
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('OneSignal push failed:', json);
    } else {
      console.log('OneSignal push sent, id:', json.id);
    }
  } catch (e) {
    console.error('OneSignal fetch error:', e);
  }
}

function runtimeDependencies(): SendNotificationDependencies {
  return {
    createClient,
    authorize: authorizeServiceRole,
    loadLiveUser,
    checkBlockingRelationship,
    sendPush: sendOneSignalPush,
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  };
}

Deno.serve((req) => handleSendNotificationRequest(req, runtimeDependencies()));