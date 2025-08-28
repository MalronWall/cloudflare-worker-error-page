/**
 * Creates an abort controller with timeout
 * @param {number} timeoutMs - Timeout in milliseconds before abort
 * @returns {[AbortController, number]} Controller and timeout ID
 */
function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return [controller, id];
}

/**
 * Performs a request with HEAD/GET retry
 * @param {string} url - URL to test
 * @param {Object} options - Request options
 * @returns {Promise<Response>} Request response
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
   * Checks if NPM is accessible
   * @param {Object} options - Request options
   * @returns {Promise<boolean>} true if NPM is accessible
   */
  async isNpmUp({ timeoutMs = 10000 } = {}, env) {
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
   * Checks if origin is reachable
   * @param {Object} options - Request options
   * @returns {Promise<boolean|null>} Reachability state
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
   * Checks if response comes from Cloudflare
   * @param {Response} resp - HTTP response to check
   * @returns {boolean} true if it's a Cloudflare error
   */
  isCloudflareError(resp) {
    if (!resp?.headers) return false;
    const server = resp.headers.get('server') || '';
    const ray = resp.headers.get('cf-ray') || '';
    return server.toLowerCase().includes('cloudflare') && ray.length > 0;
  },

  /**
   * Extracts Cloudflare error code
   * @param {Response} resp - HTTP response to analyze
   * @returns {Promise<number|null>} Error code or null
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
   * Determines page type for 5xx errors
   * @param {number} status - HTTP status code
   * @returns {string} Page type to display
   */
  pageForCloudflare5xx(status) {
    if (status === 523) return 'BOX';
    if ([521, 522, 524, 525, 526].includes(status)) return 'SERVER';
    return 'SERVER';
  }
};