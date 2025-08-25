import { c_redirect } from './custom-redirect.js'
import maintenanceHtml from './html/maintenance.js'

export default {
  async fetch(request, env, ctx) {
    const host = request.headers.get('host');
    const url = new URL(request.url);

    // Lecture des états de maintenance (avec gestion d'erreur)
    let globalMaintenance = await env.MAINTENANCE_KV.get('MAINTENANCE_GLOBAL');
    let subdomainsMaintenanceRaw = await env.MAINTENANCE_KV.get('MAINTENANCE_SUBDOMAINS');
    let subdomainsMaintenance = [];
    try { subdomainsMaintenance = JSON.parse(subdomainsMaintenanceRaw || '[]'); } catch { subdomainsMaintenance = []; }

    // Lecture du bandeau (KV)
    let bannerSubdomainsRaw = await env.MAINTENANCE_KV.get('BANNER_SUBDOMAINS');
    let bannerMessage = await env.MAINTENANCE_KV.get('BANNER_MESSAGE');
    let bannerSubdomains = [];
    try { bannerSubdomains = JSON.parse(bannerSubdomainsRaw || '[]'); } catch { bannerSubdomains = []; }
    if (typeof bannerMessage !== 'string') bannerMessage = '';

    const isGlobalMaintenance = globalMaintenance === 'true';
    const isSubdomainMaintenance = subdomainsMaintenance.includes(host);
    const isMaintenance = isGlobalMaintenance || isSubdomainMaintenance;

    // Interface de contrôle de maintenance (admin)
    if (host === env.MAINTENANCE_DOMAIN && url.pathname === '/') {
      return new Response(
        maintenanceHtml(isGlobalMaintenance, subdomainsMaintenance, bannerSubdomains, bannerMessage),
        { headers: { 'content-type': 'text/html' } }
      );
    }

    // API de gestion de la maintenance et du bandeau
    if (url.pathname.startsWith('/worker/api/')) {
      if (host !== env.MAINTENANCE_DOMAIN) {
        return new Response(`Forbidden: Only accessible on ${env.MAINTENANCE_DOMAIN}`, { status: 403 });
      }

      if (url.pathname === '/worker/api/toggle-maintenance/global' && request.method === 'POST') {
        await env.MAINTENANCE_KV.put('MAINTENANCE_GLOBAL', isGlobalMaintenance ? 'false' : 'true');
        return new Response('Maintenance globale mise à jour');
      }

      if (url.pathname === '/worker/api/maintenance/subdomain/add' && request.method === 'POST') {
        const { subdomain } = await request.json();
        if (!subdomainsMaintenance.includes(subdomain)) {
          subdomainsMaintenance.push(subdomain);
          await env.MAINTENANCE_KV.put('MAINTENANCE_SUBDOMAINS', JSON.stringify(subdomainsMaintenance));
        }
        return new Response('Sous-domaine ajouté');
      }

      if (url.pathname === '/worker/api/maintenance/subdomain/remove' && request.method === 'POST') {
        const { subdomain } = await request.json();
        const newList = subdomainsMaintenance.filter(d => d !== subdomain);
        await env.MAINTENANCE_KV.put('MAINTENANCE_SUBDOMAINS', JSON.stringify(newList));
        return new Response('Sous-domaine retiré');
      }

      // Ajout pour gérer le bandeau :
      if (url.pathname === '/worker/api/banner/subdomains' && request.method === 'POST') {
        const { subdomains } = await request.json();
        if (Array.isArray(subdomains)) {
          await env.MAINTENANCE_KV.put('BANNER_SUBDOMAINS', JSON.stringify(subdomains));
          return new Response('Liste des sous-domaines du bandeau mise à jour');
        } else {
          return new Response('Format attendu: { subdomains: [...] }', { status: 400 });
        }
      }

      if (url.pathname === '/worker/api/banner/subdomains/add' && request.method === 'POST') {
        const { subdomain } = await request.json();
        if (typeof subdomain !== 'string') return new Response('Format attendu: { subdomain: "..." }', { status: 400 });
        if (!bannerSubdomains.includes(subdomain)) {
          bannerSubdomains.push(subdomain);
          await env.MAINTENANCE_KV.put('BANNER_SUBDOMAINS', JSON.stringify(bannerSubdomains));
        }
        return new Response('Sous-domaine ajouté au bandeau');
      }

      if (url.pathname === '/worker/api/banner/subdomains/remove' && request.method === 'POST') {
        const { subdomain } = await request.json();
        if (typeof subdomain !== 'string') return new Response('Format attendu: { subdomain: "..." }', { status: 400 });
        const newList = bannerSubdomains.filter(d => d !== subdomain);
        await env.MAINTENANCE_KV.put('BANNER_SUBDOMAINS', JSON.stringify(newList));
        return new Response('Sous-domaine retiré du bandeau');
      }

      if (url.pathname === '/worker/api/banner/message' && request.method === 'POST') {
        const { message } = await request.json();
        if (typeof message === 'string') {
          await env.MAINTENANCE_KV.put('BANNER_MESSAGE', message);
          return new Response('Message du bandeau mis à jour');
        } else {
          return new Response('Format attendu: { message: "..." }', { status: 400 });
        }
      }

      return new Response('Forbidden', { status: 403 });
    }

    // Gestion des erreurs et redirections personnalisées
    let response;
    try {
      response = await fetch(request);
    } catch (err) {
      // Origin/tunnel totalement injoignable (ex: tunnel down, réseau coupé)
      const redirectResponse = await c_redirect(request, null, err, isMaintenance, env);
      if (redirectResponse) return redirectResponse;
      return new Response('Upstream unreachable', { status: 502 });
    }

    // Vérifie s'il faut afficher une page personnalisée
    const redirectResponse = await c_redirect(request, response, null, isMaintenance, env);
    if (redirectResponse) return redirectResponse;

    // Ajout du bandeau sur les sous-domaines choisis (on compare host complet)
    const showBanner = bannerMessage && bannerSubdomains.includes(host);

    if (showBanner && response.headers.get('content-type')?.includes('text/html')) {
      let text = await response.text();
      // Injecte le bandeau juste après <body>
      text = text.replace(/<body[^>]*>/i, `$&<div style="background:#ffc; color:#222; padding:12px; text-align:center; border-bottom:1px solid #eee; font-weight:bold;">${bannerMessage}</div>`);
      return new Response(text, response);
    }

    return response;
  }
}