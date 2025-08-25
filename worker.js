import { c_redirect } from './custom-redirect.js'
import maintenanceHtml from './html/maintenance.js'

export default {
  async fetch(request, env, ctx) {
    const host = request.headers.get('host');
    const url = new URL(request.url);

    // Lecture des états de maintenance
    const [globalMaintenance, subdomainsMaintenance] = await Promise.all([
      env.MAINTENANCE_KV.get('MAINTENANCE_GLOBAL'),
      env.MAINTENANCE_KV.get('MAINTENANCE_SUBDOMAINS').then(s => JSON.parse(s || '[]'))
    ]);

    const isGlobalMaintenance = globalMaintenance === 'true';
    const isSubdomainMaintenance = subdomainsMaintenance.includes(host);
    const isMaintenance = isGlobalMaintenance || isSubdomainMaintenance;

    // Interface de contrôle de maintenance
    if (host === env.MAINTENANCE_DOMAIN && url.pathname === '/') {
      return new Response(
        maintenanceHtml(isGlobalMaintenance, subdomainsMaintenance),
        { headers: { 'content-type': 'text/html' } }
      );
    }

    // API de gestion de la maintenance
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

    return response;
  }
}