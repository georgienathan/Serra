// supabase/functions/oauth-init/index.ts
// Initiate OAuth flow for wearable providers
// URL: https://<project>.supabase.co/functions/v1/oauth-init/:provider

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProviderConfig {
  authUrl: string;
  clientId: string;
  scope: string;
  responseType: string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  oura: {
    authUrl: 'https://cloud.ouraring.com/oauth/authorize',
    clientId: Deno.env.get('OURA_CLIENT_ID') || '',
    scope: 'daily sleep workout',
    responseType: 'code',
  },
  strava: {
    authUrl: 'https://www.strava.com/oauth/authorize',
    clientId: Deno.env.get('STRAVA_CLIENT_ID') || '',
    scope: 'read,activity:read_all',
    responseType: 'code',
  },
  fitbit: {
    authUrl: 'https://www.fitbit.com/oauth2/authorize',
    clientId: Deno.env.get('FITBIT_CLIENT_ID') || '',
    scope: 'activity heartrate sleep',
    responseType: 'code',
  },
  whoop: {
    authUrl: 'https://api.prod.whoop.com/oauth/authorize',
    clientId: Deno.env.get('WHOOP_CLIENT_ID') || '',
    scope: 'read:recovery read:sleep read:workout',
    responseType: 'code',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = url.pathname.split('/').pop() as string;
    const userId = url.searchParams.get('user_id');
    const redirectUri = url.searchParams.get('redirect_uri');

    if (!userId || !redirectUri) {
      throw new Error('Missing user_id or redirect_uri');
    }

    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    if (!config.clientId) {
      // Mock mode - no client ID configured
      console.warn(`${provider} client ID not configured - using mock mode`);
      
      // Redirect back with mock success
      const mockRedirect = `${redirectUri}?provider=${provider}&status=mock`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': mockRedirect,
        },
      });
    }

    // Build OAuth URL
    const state = btoa(JSON.stringify({ userId, provider, redirectUri }));
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback/${provider}`);
    authUrl.searchParams.set('response_type', config.responseType);
    authUrl.searchParams.set('scope', config.scope);
    authUrl.searchParams.set('state', state);

    // Redirect to provider's OAuth page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': authUrl.toString(),
      },
    });

  } catch (error) {
    console.error('OAuth init error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'OAuth initialization failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
