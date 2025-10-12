// supabase/functions/_cron/sync-all-providers.ts
// Cron job to automatically sync all connected accounts
// Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
// Configure in Supabase Dashboard: Database > Cron Jobs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all connected accounts
    const { data: accounts, error } = await supabase
      .from('source_accounts')
      .select('user_id, provider')
      .eq('status', 'connected');

    if (error) {
      throw error;
    }

    console.log(`Found ${accounts?.length || 0} accounts to sync`);

    let successCount = 0;
    let errorCount = 0;

    // Trigger sync for each account
    for (const account of accounts || []) {
      try {
        const { error: syncError } = await supabase.functions.invoke('sync-provider', {
          body: {
            provider: account.provider,
            user_id: account.user_id,
          },
        });

        if (syncError) {
          console.error(`Sync failed for ${account.provider} (user: ${account.user_id}):`, syncError);
          errorCount++;
        } else {
          console.log(`Synced ${account.provider} for user ${account.user_id}`);
          successCount++;
        }
      } catch (e: any) {
        console.error(`Error syncing ${account.provider}:`, e);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: accounts?.length || 0,
      synced: successCount,
      errors: errorCount,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
