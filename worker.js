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
  return {
    isGlobalMaintenance: globalMaintenance === 'true',
    subdomainsMaintenance,
    isSubdomainMaintenance: subdomainsMaintenance.includes(host),
    bannerSubdomains,
    bannerMessage: typeof bannerMessage === 'string' ? bannerMessage : ''
  };
}

// Inject banner into HTML response
async function injectBanner(response, bannerMessage) {
  let text = await response.text();
  text = text.replace(
    /<body[^>]*>/i,
    `$&<div style="background:#ffc; color:#222; padding:12px; text-align:center; border-bottom:1px solid #eee; font-weight:bold;">${bannerMessage}</div>`
  );
  // Return new Response preserving status and headers from original response
  return new Response(text, { status: response.status, headers: response.headers });
}

// Log request with server IP information
function logRequest(request, host, note = null, responseHeaders = null, env = null) {
  // Try to get server/origin IP from common headers set by origin if available
  let actualServerIP = null;
  if (responseHeaders) {
    const candidates = ['x-origin-ip', 'x-server-ip', 'x-real-ip', 'x-origin-server-ip', 'x-forwarded-for'];
    for (const h of candidates) {
      const v = responseHeaders.get(h);
      if (v) {
        // x-forwarded-for may contain a list
        actualServerIP = v.split(',')[0].trim();
        break;
      }
    }
    // some proxies set a Server header (often "cloudflare") — ignore that as origin IP
    if (!actualServerIP) {
      const serverHdr = responseHeaders.get('server');
      if (serverHdr && serverHdr.toLowerCase() !== 'cloudflare') actualServerIP = serverHdr;
    }
  }

  // If no origin IP found, add a hint for the developer
  const hint = actualServerIP ? null : 'no-origin-ip-found; ensure origin sets X-Origin-IP or use unproxied host';
  console.log(JSON.stringify({
    note: note || null,
    host,
    serverIP: actualServerIP || 'cloudflare',
    hint
  }));
}

export default {
  async fetch(request, env, ctx) {
    const host = request.headers.get('host');
    const url = new URL(request.url);

    // Log incoming request (no response headers yet)
    logRequest(request, host, 'incoming', null, env);

    // Read state
    const state = await getMaintenanceState(env, host);
    const isMaintenance = state.isGlobalMaintenance || state.isSubdomainMaintenance;

    // Maintenance control interface (admin)
    if (host === env.MAINTENANCE_DOMAIN && url.pathname === '/') {
      return new Response(
        maintenanceHtml(state.isGlobalMaintenance, state.subdomainsMaintenance, state.bannerSubdomains, state.bannerMessage),
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
      
      // Log after getting response (to capture server info)
      logRequest(request, host, 'fetched', response.headers, env);
      
    } catch (err) {
      // Log failed request
      logRequest(request, host, 'server-unreachable', null, env);
      
      const redirectResponse = await c_redirect(request, null, err, isMaintenance, env);
      if (redirectResponse) return redirectResponse;
      return new Response('Upstream unreachable', { status: 502 });
    }

    // Custom error page
    const redirectResponse = await c_redirect(request, response, null, isMaintenance, env);
    if (redirectResponse) return redirectResponse;

    // Banner injection
    const showBanner = state.bannerMessage && state.bannerSubdomains.includes(host);
    if (showBanner && response.headers.get('content-type')?.includes('text/html')) {
      return await injectBanner(response, state.bannerMessage);
    }

    return response;
  }
}