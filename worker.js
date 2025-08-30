import { c_redirect } from './custom-redirect.js'
import maintenanceHtml from './html/maintenance.js'
import { handleApi } from './handle-api.js'

// Helper to safely parse JSON
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str || ''); } catch { return fallback; }
}

// Simple in-memory cache (per worker instance)
const cache = {
  maintenance: { value: null, ts: 0 },
  is4g: { value: null, ts: 0 }
};

// Read maintenance and banner states from KV (single key) with optional cache
async function getMaintenanceState(env, host, useCache = true) {
  // Read cache config from env
  const cacheEnabled = env.ENABLE_CACHE === undefined ? true : env.ENABLE_CACHE === true || env.ENABLE_CACHE === 'true';
  const cacheTtl = env.CACHE_TTL_MS ? parseInt(env.CACHE_TTL_MS, 10) : 60000;

  const now = Date.now();
  let stateObj;
  if (useCache && cacheEnabled) {
    if (cache.maintenance.value && (now - cache.maintenance.ts < cacheTtl)) {
      stateObj = cache.maintenance.value;
    } else {
      const stateRaw = await env.MAINTENANCE_KV.get('MAINTENANCE_STATE');
      stateObj = safeJsonParse(stateRaw, {
        isGlobalMaintenance: false,
        subdomainsMaintenance: [],
        bannerSubdomains: [],
        bannerMessage: ''
      });
      cache.maintenance.value = stateObj;
      cache.maintenance.ts = now;
    }
  } else {
    const stateRaw = await env.MAINTENANCE_KV.get('MAINTENANCE_STATE');
    stateObj = safeJsonParse(stateRaw, {
      isGlobalMaintenance: false,
      subdomainsMaintenance: [],
      bannerSubdomains: [],
      bannerMessage: ''
    });
  }

  // Cache for wan-is-4g
  let is4gMode;
  if (useCache && cacheEnabled) {
    if (cache.is4g.value !== null && (now - cache.is4g.ts < cacheTtl)) {
      is4gMode = cache.is4g.value;
    } else {
      is4gMode = await env.MAINTENANCE_KV.get('wan-is-4g');
      cache.is4g.value = is4gMode;
      cache.is4g.ts = now;
    }
  } else {
    is4gMode = await env.MAINTENANCE_KV.get('wan-is-4g');
  }

  return {
    isGlobalMaintenance: stateObj.isGlobalMaintenance === true || stateObj.isGlobalMaintenance === 'true',
    subdomainsMaintenance: Array.isArray(stateObj.subdomainsMaintenance) ? stateObj.subdomainsMaintenance : [],
    isSubdomainMaintenance: Array.isArray(stateObj.subdomainsMaintenance) ? stateObj.subdomainsMaintenance.includes(host) : false,
    bannerSubdomains: Array.isArray(stateObj.bannerSubdomains) ? stateObj.bannerSubdomains : [],
    bannerMessage: typeof stateObj.bannerMessage === 'string' ? stateObj.bannerMessage : '',
    is4gMode: is4gMode === 'true'
  };
}

// Inject banner into HTML response
async function injectBanner(response, bannerMessage) {
  let text = await response.text();
  text = text.replace(
    /<body[^>]*>/i,
    `$&<div style="background:#ffc; color:#222; padding:12px; text-align:center; border-bottom:1px solid #eee; font-weight:bold;">${bannerMessage}</div>`
  );
  return new Response(text, response);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = request.headers.get('host');

    // Read state (cache by default)
    let state = await getMaintenanceState(env, host);
    const isMaintenance = state.isGlobalMaintenance || state.isSubdomainMaintenance;

    // Maintenance control interface (admin) - NO CACHE
    if (host === env.MAINTENANCE_DOMAIN && url.pathname === '/') {
      state = await getMaintenanceState(env, host, false);
      return new Response(
        maintenanceHtml(state.isGlobalMaintenance, state.subdomainsMaintenance, state.bannerSubdomains, state.bannerMessage, env.LANGUAGE || 'EN'),
        { headers: { 'content-type': 'text/html' } }
      );
    }

    // API routes
    if (url.pathname.startsWith('/worker/api/')) {
      return await handleApi(request, url, host, env, state);
    }

    // Custom error/redirect handling
    let response;
    try {
      response = await fetch(request);
    } catch (err) {
      // isMaintenance is now always defined above
      const redirectResponse = await c_redirect(request, null, err, isMaintenance, env);
      if (redirectResponse) return redirectResponse;
      return new Response('Upstream unreachable', { status: 502 });
    }

    // Custom error page
    const redirectResponse = await c_redirect(request, response, null, isMaintenance, env);
    if (redirectResponse) return redirectResponse;

    // Banner injection - check for 4G mode or regular banner
    let showBanner = false;
    let bannerMessage = '';
    
    if (env.ENABLE_4G_BANNER && state.is4gMode) {
      showBanner = true;
      bannerMessage = env.TEXT_4G_BANNER_MESSAGE;
    } else if (state.bannerMessage && state.bannerSubdomains.includes(host)) {
      showBanner = true;
      bannerMessage = state.bannerMessage;
    }
    
    if (showBanner && response.headers.get('content-type')?.includes('text/html')) {
      return await injectBanner(response, bannerMessage);
    }

    // Report error endpoint
    if (url.pathname === '/report-error' && request.method === 'POST') {
      try {
        const { fullName, errorCode, siteName, redirectUrl } = await request.json();
        const webhookUrl = env.DISCORD_WEBHOOK_URL;

        if (!webhookUrl) {
          console.error('Webhook URL not configured');
          return new Response(JSON.stringify({ ok: false, error: 'Webhook URL not configured' }), { status: 500 });
        }

        const payload = {
          content: `🚨 **Erreur signalée**\n- **Nom**: ${fullName}\n- **Code d'erreur**: ${errorCode}\n- **Site**: ${siteName}\n- **URL**: ${redirectUrl}`
        };

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Discord webhook failed:', res.status, errorText);
          return new Response(JSON.stringify({ ok: false, error: 'Failed to send webhook', details: errorText }), { status: 502 });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      } catch (err) {
        console.error('Error handling /report-error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Internal Server Error' }), { status: 500 });
      }
    }

    return response;
  }
}