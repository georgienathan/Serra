// supabase/functions/oauth-callback/index.ts
// Handle OAuth callback and exchange code for tokens
// URL: https://<project>.supabase.co/functions/v1/oauth-callback/:provider

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: string;
}

const PROVIDER_CONFIGS: Record<string, any> = {
  oura: {
    tokenUrl: 'https://api.ouraring.com/oauth/token',
    clientId: Deno.env.get('OURA_CLIENT_ID'),
    clientSecret: Deno.env.get('OURA_CLIENT_SECRET'),
  },
  strava: {
    tokenUrl: 'https://www.strava.com/oauth/token',
    clientId: Deno.env.get('STRAVA_CLIENT_ID'),
    clientSecret: Deno.env.get('STRAVA_CLIENT_SECRET'),
  },
  fitbit: {
    tokenUrl: 'https://api.fitbit.com/oauth2/token',
    clientId: Deno.env.get('FITBIT_CLIENT_ID'),
    clientSecret: Deno.env.get('FITBIT_CLIENT_SECRET'),
  },
  whoop: {
    tokenUrl: 'https://api.prod.whoop.com/oauth/token',
    clientId: Deno.env.get('WHOOP_CLIENT_ID'),
    clientSecret: Deno.env.get('WHOOP_CLIENT_SECRET'),
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = url.pathname.split('/').pop() as string;
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state');
    }

    // Decode state
    const { userId, redirectUri } = JSON.parse(atob(state));

    const config = PROVIDER_CONFIGS[provider];
    if (!config || !config.clientId || !config.clientSecret) {
      throw new Error(`Provider ${provider} not configured`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback/${provider}`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store tokens in source_accounts
    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const { error: dbError } = await supabase
      .from('source_accounts')
      .upsert({
        user_id: userId,
        provider,
        status: 'connected',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        provider_user_id: tokens.user_id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Redirect back to app
    const finalRedirect = `${redirectUri}?provider=${provider}&status=connected`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': finalRedirect,
      },
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Try to redirect back with error
    try {
      const url = new URL(req.url);
      const state = url.searchParams.get('state');
      if (state) {
        const { redirectUri } = JSON.parse(atob(state));
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': `${redirectUri}?status=error&message=${encodeURIComponent(error.message)}`,
          },
        });
      }
    } catch {}
    
    return new Response(JSON.stringify({ 
      error: error.message || 'OAuth callback failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
