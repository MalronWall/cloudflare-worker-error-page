/**
 * Crée un contrôleur d'abandon avec timeout
 * @param {number} timeoutMs - Délai avant abandon en millisecondes
 * @returns {[AbortController, number]} Contrôleur et ID du timeout
 */
function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return [controller, id];
}

/**
 * Effectue une requête avec retry HEAD/GET
 * @param {string} url - URL à tester
 * @param {Object} options - Options de la requête
 * @returns {Promise<Response>} Réponse de la requête
 */
async function fetchWithMethodFallback(url, { signal, ...options } = {}) {
  let response = await fetch(url, {
    method: 'HEAD',
    signal,
    cf: { cacheTtl: 0, cacheEverything: false },
    ...options
  });

  if (response.status === 405) {
    response = await fetch(url, {
      method: 'GET',
      signal,
      cf: { cacheTtl: 0, cacheEverything: false },
      ...options
    });
  }

  return response;
}

export const HELPER = {
  /**
   * Vérifie si NPM est accessible
   * @param {Object} options - Options de la requête
   * @returns {Promise<boolean>} true si NPM est accessible
   */
  async isNpmUp({ timeoutMs = 2000 } = {}, env) {
    const [controller, id] = createTimeoutController(timeoutMs);
    try {
      const response = await fetchWithMethodFallback(env.NPM_HEALTH_URL, { signal: controller.signal });
      if (this.isCloudflareError(response) && response.status >= 520 && response.status <= 529) {
        return false;
      }
      return response.status > 0 && response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(id);
    }
  },

  /**
   * Vérifie si l'origine est accessible
   * @param {Object} options - Options de la requête
   * @returns {Promise<boolean|null>} État de l'accessibilité
   */
  async isOriginReachable({ timeoutMs = 1500 } = {}, env) {
    if (!env.ORIGIN_PING_URL) return null;
    
    const [controller, id] = createTimeoutController(timeoutMs);
    try {
      const response = await fetchWithMethodFallback(env.ORIGIN_PING_URL, { signal: controller.signal });
      return response.status > 0 && response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(id);
    }
  },

  /**
   * Vérifie si la réponse vient de Cloudflare
   * @param {Response} resp - Réponse HTTP à vérifier
   * @returns {boolean} true si c'est une erreur Cloudflare
   */
  isCloudflareError(resp) {
    if (!resp?.headers) return false;
    const server = resp.headers.get('server') || '';
    const ray = resp.headers.get('cf-ray') || '';
    return server.toLowerCase().includes('cloudflare') && ray.length > 0;
  },

  /**
   * Extrait le code d'erreur Cloudflare
   * @param {Response} resp - Réponse HTTP à analyser
   * @returns {Promise<number|null>} Code d'erreur ou null
   */
  async getCloudflareErrorCode(resp) {
    try {
      if (!resp) return null;
      const text = await resp.clone().text();
      const match = text.match(/Error\s+(\d{3,4})/i);
      return match ? parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  },

  /**
   * Détermine le type de page pour les erreurs 5xx
   * @param {number} status - Code de statut HTTP
   * @returns {string} Type de page à afficher
   */
  pageForCloudflare5xx(status) {
    if (status === 523) return 'BOX';
    if ([521, 522, 524, 525, 526].includes(status)) return 'SERVER';
    return 'SERVER';
  }
};