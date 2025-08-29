async function getStateObj(env) {
  const raw = await env.MAINTENANCE_KV.get('MAINTENANCE_STATE');
  try {
    return JSON.parse(raw || '') || {};
  } catch {
    return {};
  }
}

async function setStateObj(env, obj) {
  await env.MAINTENANCE_KV.put('MAINTENANCE_STATE', JSON.stringify(obj));
  invalidateCache(env);
}

// Invalidate cache helper
function invalidateCache(env) {
  const cacheEnabled = env.ENABLE_CACHE === undefined ? true : env.ENABLE_CACHE === true || env.ENABLE_CACHE === 'true';
  if (cacheEnabled && globalThis.cache) {
    globalThis.cache.maintenance = { value: null, ts: 0 };
    globalThis.cache.is4g = { value: null, ts: 0 };
  }
}

// Helper to fetch Unifi API data
export async function fetchUnifiData(env) {
  const apiKey = await env.UNIFI_API_KEY; // Secret API key
  const response = await fetch('https://api.ui.com/v1/sites?pageSize=1', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-API-Key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Unifi API call failed with status ${response.status}`);
  }

  const data = await response.json();
  const wanLTEFailover = data?.data?.[0]?.statistics?.wans?.WAN_LTE_FAILOVER;
  const wanUptime = wanLTEFailover?.wanUptime;

  return wanUptime !== undefined && wanUptime < 100; // 4G is active if uptime < 100
}

export async function handleApi(request, url, host, env, state) {
  // Restrict API access to the maintenance domain
  if (host !== env.MAINTENANCE_DOMAIN) {
    return new Response(`Forbidden: Only accessible on ${env.MAINTENANCE_DOMAIN}`, { status: 403 });
  }

  // Toggle global maintenance mode
  if (url.pathname === '/worker/api/toggle-maintenance/global' && request.method === 'POST') {
    const obj = await getStateObj(env);
    obj.isGlobalMaintenance = !(obj.isGlobalMaintenance === true || obj.isGlobalMaintenance === 'true');
    await setStateObj(env, obj);
    return new Response('Maintenance globale mise à jour');
  }

  // Add a subdomain to maintenance list
  if (url.pathname === '/worker/api/maintenance/subdomain/add' && request.method === 'POST') {
    const { subdomain } = await request.json();
    const obj = await getStateObj(env);
    obj.subdomainsMaintenance = Array.isArray(obj.subdomainsMaintenance) ? obj.subdomainsMaintenance : [];
    if (!obj.subdomainsMaintenance.includes(subdomain)) {
      obj.subdomainsMaintenance.push(subdomain);
      await setStateObj(env, obj);
    }
    return new Response('Sous-domaine ajouté');
  }

  // Remove a subdomain from maintenance list
  if (url.pathname === '/worker/api/maintenance/subdomain/remove' && request.method === 'POST') {
    const { subdomain } = await request.json();
    const obj = await getStateObj(env);
    obj.subdomainsMaintenance = Array.isArray(obj.subdomainsMaintenance) ? obj.subdomainsMaintenance : [];
    obj.subdomainsMaintenance = obj.subdomainsMaintenance.filter(d => d !== subdomain);
    await setStateObj(env, obj);
    return new Response('Sous-domaine retiré');
  }

  // Set the list of subdomains for the banner
  if (url.pathname === '/worker/api/banner/subdomains' && request.method === 'POST') {
    const { subdomains } = await request.json();
    if (Array.isArray(subdomains)) {
      const obj = await getStateObj(env);
      obj.bannerSubdomains = subdomains;
      await setStateObj(env, obj);
      return new Response('Liste des sous-domaines du bandeau mise à jour');
    } else {
      return new Response('Format attendu: { subdomains: [...] }', { status: 400 });
    }
  }

  // Add a subdomain to the banner list
  if (url.pathname === '/worker/api/banner/subdomains/add' && request.method === 'POST') {
    const { subdomain } = await request.json();
    if (typeof subdomain !== 'string') return new Response('Format attendu: { subdomain: "..." }', { status: 400 });
    const obj = await getStateObj(env);
    obj.bannerSubdomains = Array.isArray(obj.bannerSubdomains) ? obj.bannerSubdomains : [];
    if (!obj.bannerSubdomains.includes(subdomain)) {
      obj.bannerSubdomains.push(subdomain);
      await setStateObj(env, obj);
    }
    return new Response('Sous-domaine ajouté au bandeau');
  }

  // Remove a subdomain from the banner list
  if (url.pathname === '/worker/api/banner/subdomains/remove' && request.method === 'POST') {
    const { subdomain } = await request.json();
    if (typeof subdomain !== 'string') return new Response('Format attendu: { subdomain: "..." }', { status: 400 });
    const obj = await getStateObj(env);
    obj.bannerSubdomains = Array.isArray(obj.bannerSubdomains) ? obj.bannerSubdomains : [];
    obj.bannerSubdomains = obj.bannerSubdomains.filter(d => d !== subdomain);
    await setStateObj(env, obj);
    return new Response('Sous-domaine retiré du bandeau');
  }

  // Set the banner message
  if (url.pathname === '/worker/api/banner/message' && request.method === 'POST') {
    const { message } = await request.json();
    if (typeof message === 'string') {
      const obj = await getStateObj(env);
      obj.bannerMessage = message;
      await setStateObj(env, obj);
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
    invalidateCache(env);
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
      invalidateCache(env);
      return new Response('Mode 4G mis à jour');
    } else {
      return new Response('Format attendu: { enabled: true/false }', { status: 400 });
    }
  }

  // Fallback for unknown API routes
  return new Response('Forbidden', { status: 403 });
}
