import { c_redirect } from './custom-redirect.js'
import maintenanceHtml from './html/maintenance.js'
import { handleApi } from './handle-api.js'

// Helper to safely parse JSON
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str || '[]'); } catch { return fallback; }
}

// Cache for KV data
const kvCache = {
  data: null,
  timestamp: 0,
  ttl: 300000 // Cache TTL in milliseconds (5 minutes)
};

// Read maintenance and banner states from KV with caching
async function getMaintenanceState(env, host) {
  const now = Date.now();

  // Return cached data if valid
  if (kvCache.data && (now - kvCache.timestamp < kvCache.ttl)) {
    return kvCache.data;
  }

  // Fetch fresh data from KV
  const globalMaintenance = await env.MAINTENANCE_KV.get('MAINTENANCE_GLOBAL');
  const subdomainsMaintenanceRaw = await env.MAINTENANCE_KV.get('MAINTENANCE_SUBDOMAINS');
  const bannerSubdomainsRaw = await env.MAINTENANCE_KV.get('BANNER_SUBDOMAINS');
  const bannerMessage = await env.MAINTENANCE_KV.get('BANNER_MESSAGE');
  const is4gMode = await env.MAINTENANCE_KV.get('wan-is-4g');

  const subdomainsMaintenance = safeJsonParse(subdomainsMaintenanceRaw, []);
  const bannerSubdomains = safeJsonParse(bannerSubdomainsRaw, []);

  // Update cache
  kvCache.data = {
    isGlobalMaintenance: globalMaintenance === 'true',
    subdomainsMaintenance,
    isSubdomainMaintenance: subdomainsMaintenance.includes(host),
    bannerSubdomains,
    bannerMessage: typeof bannerMessage === 'string' ? bannerMessage : '',
    is4gMode: is4gMode === 'true'
  };
  kvCache.timestamp = now;

  return kvCache.data;
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
    const host = request.headers.get('host');
    const url = new URL(request.url);

    // Read state
    const state = await getMaintenanceState(env, host);
    const isMaintenance = state.isGlobalMaintenance || state.isSubdomainMaintenance;

    // Maintenance control interface (admin)
    if (host === env.MAINTENANCE_DOMAIN && url.pathname === '/') {
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

    return response;
  }
}