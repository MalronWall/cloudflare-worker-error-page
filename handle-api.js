export async function handleApi(request, url, host, env, state) {
  // Restrict API access to the maintenance domain
  if (host !== env.MAINTENANCE_DOMAIN) {
    return new Response(`Forbidden: Only accessible on ${env.MAINTENANCE_DOMAIN}`, { status: 403 });
  }

  // Toggle global maintenance mode
  if (url.pathname === '/worker/api/toggle-maintenance/global' && request.method === 'POST') {
    const newState = { ...state, isGlobalMaintenance: !state.isGlobalMaintenance };
    await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(newState));
    return new Response('Maintenance globale mise à jour');
  }

  // Add a subdomain to maintenance list
  if (url.pathname === '/worker/api/maintenance/subdomain/add' && request.method === 'POST') {
    const { subdomain } = await request.json();
    if (typeof subdomain === 'string' && subdomain.trim() && !state.subdomainsMaintenance.includes(subdomain)) {
      state.subdomainsMaintenance.push(subdomain);
      const newState = { ...state, subdomainsMaintenance: state.subdomainsMaintenance };
      await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(newState));
    }
    return new Response('Sous-domaine ajouté');
  }

  // Remove a subdomain from maintenance list
  if (url.pathname === '/worker/api/maintenance/subdomain/remove' && request.method === 'POST') {
    const { subdomain } = await request.json();
    if (typeof subdomain === 'string' && subdomain.trim()) {
      const newList = state.subdomainsMaintenance.filter(d => d !== subdomain);
      const newState = { ...state, subdomainsMaintenance: newList };
      await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(newState));
    }
    return new Response('Sous-domaine retiré');
  }

  // Set the list of subdomains for the banner
  if (url.pathname === '/worker/api/banner/subdomains' && request.method === 'POST') {
    const { subdomains } = await request.json();
    if (Array.isArray(subdomains)) {
      await env.MAINTENANCE_KV.put('BANNER_SUBDOMAINS', JSON.stringify(subdomains));
      return new Response('Liste des sous-domaines du bandeau mise à jour');
    } else {
      return new Response('Format attendu: { subdomains: [...] }', { status: 400 });
    }
  }

  // Add a subdomain to the banner list
  if (url.pathname === '/worker/api/banner/subdomains/add' && request.method === 'POST') {
    const { subdomain } = await request.json();
    if (typeof subdomain === 'string' && subdomain.trim() && !state.bannerSubdomains.includes(subdomain)) {
      state.bannerSubdomains.push(subdomain);
      const newState = { ...state, bannerSubdomains: state.bannerSubdomains };
      await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(newState));
    }
    return new Response('Sous-domaine ajouté au bandeau');
  }

  // Remove a subdomain from the banner list
  if (url.pathname === '/worker/api/banner/subdomains/remove' && request.method === 'POST') {
    const { subdomain } = await request.json();
    if (typeof subdomain === 'string' && subdomain.trim()) {
      const newList = state.bannerSubdomains.filter(d => d !== subdomain);
      const newState = { ...state, bannerSubdomains: newList };
      await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(newState));
    }
    return new Response('Sous-domaine retiré du bandeau');
  }

  // Set the banner message
  if (url.pathname === '/worker/api/banner/message' && request.method === 'POST') {
    const { message } = await request.json();
    if (typeof message === 'string') {
      const newState = { ...state, bannerMessage: message };
      await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(newState));
      return new Response('Message du bandeau mis à jour');
    } else {
      return new Response('Format attendu: { message: "..." }', { status: 400 });
    }
  }

  // Toggle 4G mode
  if (url.pathname === '/worker/api/toggle-4g-mode' && request.method === 'POST') {
    if (!env.ENABLE_4G_BANNER) {
      return new Response('Fonctionnalité 4G désactivée', { status: 403 });
    }
    await env.MAINTENANCE_KV.put('wan-is-4g', state.is4gMode ? 'false' : 'true');
    return new Response('Mode 4G mis à jour');
  }

  // Set 4G mode status
  if (url.pathname === '/worker/api/4g-mode' && request.method === 'POST') {
    if (!env.ENABLE_4G_BANNER) {
      return new Response('Fonctionnalité 4G désactivée', { status: 403 });
    }
    const { enabled } = await request.json();
    if (typeof enabled === 'boolean') {
      await env.MAINTENANCE_KV.put('wan-is-4g', enabled ? 'true' : 'false');
      return new Response('Mode 4G mis à jour');
    } else {
      return new Response('Format attendu: { enabled: true/false }', { status: 400 });
    }
  }

  // Fallback for unknown API routes
  return new Response('Forbidden', { status: 403 });
}
