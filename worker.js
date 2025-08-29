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

// Global in-memory storage
const globalState = {
  maintenanceState: {
    isGlobalMaintenance: false,
    subdomainsMaintenance: [],
    bannerSubdomains: [],
    bannerMessage: '',
  },
  is4gMode: false,
};

// Read maintenance and banner states from in-memory storage
async function getMaintenanceState(env, host, useCache = true) {
  // Utilise l'état global en mémoire
  const stateObj = globalState.maintenanceState;
  const is4gMode = globalState.is4gMode;

  return {
    isGlobalMaintenance: stateObj.isGlobalMaintenance,
    subdomainsMaintenance: stateObj.subdomainsMaintenance,
    isSubdomainMaintenance: stateObj.subdomainsMaintenance.includes(host),
    bannerSubdomains: stateObj.bannerSubdomains,
    bannerMessage: stateObj.bannerMessage,
    is4gMode,
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

    return response;
  }
}