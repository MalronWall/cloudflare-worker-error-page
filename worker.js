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
  return new Response(text, response);
}

// Extract IPv4 from IP string (may contain both IPv4 and IPv6)
function extractIPv4(ipString) {
  if (!ipString || ipString === 'Unknown') return 'Unknown';
  
  // Split by comma in case there are multiple IPs
  const ips = ipString.split(',').map(ip => ip.trim());
  
  // Look for IPv4 pattern (xxx.xxx.xxx.xxx)
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  for (const ip of ips) {
    if (ipv4Pattern.test(ip)) {
      return ip;
    }
  }
  
  // If no IPv4 found, return the first IP or 'Unknown'
  return ips[0] || 'Unknown';
}

// Log request with server IP information
function logRequest(request, host, serverIP, responseHeaders = null) {
  const url = new URL(request.url);
  const timestamp = new Date().toISOString();
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const cfRay = request.headers.get('cf-ray') || 'Unknown';
  
  // Try to get server IP from response headers if available
  const actualServerIP = responseHeaders?.get('cf-server-ip') || 
                         responseHeaders?.get('x-server-ip') ||
                         serverIP;
  
  // Extract IPv4 from user IP
  const userIPRaw = request.headers.get('cf-connecting-ip') || 'Unknown';
  const userIPv4 = extractIPv4(userIPRaw);
  
  console.log(JSON.stringify({
    timestamp,
    host,
    method: request.method,
    path: url.pathname,
    serverIP: extractIPv4(actualServerIP),
    userAgent,
    cfRay,
    referer: request.headers.get('referer') || '',
    userIP: userIPv4
  }));
}

export default {
  async fetch(request, env, ctx) {
    const host = request.headers.get('host');
    const url = new URL(request.url);
    
    // Get user IP (not server IP)
    const userIP = request.headers.get('cf-connecting-ip') || 'Unknown';

    // Log the request with configured server IP
    const serverIP = env.SERVER_IP || 'configured-server-ip';
    logRequest(request, host, serverIP);

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
      logRequest(request, host, 'server-via-tunnel', response.headers);
      
    } catch (err) {
      // Log failed request
      logRequest(request, host, 'server-unreachable');
      
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