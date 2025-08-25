import { c_redirect } from './custom-redirect.js'
import maintenanceHtml from './html/maintenance.js'
import { handleApi } from './handle-api.js'

// Helper to safely parse JSON
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str || '[]'); } catch { return fallback; }
}

// Read maintenance and banner states from KV
async function getMaintenanceState(env, host) {
  const globalMaintenance = await env.MAINTENANCE_KV.get('MAINTENANCE_GLOBAL');
  const subdomainsMaintenanceRaw = await env.MAINTENANCE_KV.get('MAINTENANCE_SUBDOMAINS');
  const subdomainsMaintenance = safeJsonParse(subdomainsMaintenanceRaw, []);
  const bannerSubdomainsRaw = await env.MAINTENANCE_KV.get('BANNER_SUBDOMAINS');
  const bannerMessage = await env.MAINTENANCE_KV.get('BANNER_MESSAGE');
  const bannerSubdomains = safeJsonParse(bannerSubdomainsRaw, []);
  const is4gMode = await env.MAINTENANCE_KV.get('wan-is-4g');
  
  return {
    isGlobalMaintenance: globalMaintenance === 'true',
    subdomainsMaintenance,
    isSubdomainMaintenance: subdomainsMaintenance.includes(host),
    bannerSubdomains,
    bannerMessage: typeof bannerMessage === 'string' ? bannerMessage : '',
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
    const host = request.headers.get('host');
    const url = new URL(request.url);

    // Read state
    const state = await getMaintenanceState(env, host);
    const isMaintenance = state.isGlobalMaintenance || state.isSubdomainMaintenance;

    // Maintenance control interface (admin)
    if (host === env.MAINTENANCE_DOMAIN && url.pathname === '/') {
      return new Response(
        maintenanceHtml(state.isGlobalMaintenance, state.subdomainsMaintenance, state.bannerSubdomains, state.bannerMessage, state.is4gMode),
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
    
    if (state.is4gMode) {
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