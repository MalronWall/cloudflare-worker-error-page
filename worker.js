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

    // 🔴 AJOUT DE LA BANNIÈRE POUR LE DOMAINE wingetty.jamesserver.fr
    if (host === "wingetty.jamesserver.fr") {
      let contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        let html = await response.text();
        const banner = `
          <div style="
            background: #ffcc00;
            color: #222;
            text-align: center;
            font-family: sans-serif;
            font-size: 18px;
            padding: 12px;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            box-shadow: 0 2px 6px rgba(0,0,0,.1);
          ">
            ⚠️ Attention des lenteurs peuvent survenir, ma fibre est H.S, le serveur fonctionne en 4G.
          </div>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              document.body.style.marginTop = '56px';
            });
          </script>
        `;
        // Injecte le bandeau juste après la balise <body>
        html = html.replace(/<body[^>]*>/i, match => match + banner);
        // Reconstruit la réponse avec le HTML modifié
        return new Response(html, {
          status: response.status,
          headers: response.headers
        });
      }
      // Si pas HTML, retourne la réponse normale
      return response;
    }

    // Vérifie s'il faut afficher une page personnalisée
    const redirectResponse = await c_redirect(request, response, null, isMaintenance, env);
    if (redirectResponse) return redirectResponse;

    return response;
  }
}