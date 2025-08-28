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
  console.log(`fetchWithMethodFallback START url=${url} timeoutSignalPresent=${!!signal}`);
  // Try HEAD first (with cf if provided)
  try {
    console.log(`fetchWithMethodFallback: attempting HEAD ${url}`);
    let response = await fetch(url, {
      method: 'HEAD',
      signal,
      cf: { cacheTtl: 0, cacheEverything: false },
      ...options
    });
    console.log("COUCOU fetchWithMethodFallback response.status: " + response.status);

    if (response.status === 405) {
      console.log(`fetchWithMethodFallback: HEAD returned 405, trying GET (with cf) ${url}`);
      response = await fetch(url, {
        method: 'GET',
        signal,
        cf: { cacheTtl: 0, cacheEverything: false },
        ...options
      });
      console.log("fetchWithMethodFallback GET-with-cf status: " + response.status);
    }

    return response;
  } catch (err) {
    console.log(`fetchWithMethodFallback: HEAD or GET-with-cf failed for ${url} -> ${err?.message || err}`);
    // Try GET with cf if HEAD failed, then GET without cf as a last resort
    try {
      console.log(`fetchWithMethodFallback: attempting GET (with cf) as fallback ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        signal,
        cf: { cacheTtl: 0, cacheEverything: false },
        ...options
      });
      console.log("fetchWithMethodFallback fallback GET-with-cf status: " + response.status);
      return response;
    } catch (err2) {
      console.log(`fetchWithMethodFallback: GET-with-cf also failed for ${url} -> ${err2?.message || err2}`);
      // Final attempt: GET without cf (some runtimes / dev envs reject cf option)
      try {
        console.log(`fetchWithMethodFallback: attempting GET (no cf) final fallback ${url}`);
        const response = await fetch(url, {
          method: 'GET',
          signal,
          ...options
        });
        console.log("fetchWithMethodFallback fallback GET-no-cf status: " + response.status);
        return response;
      } catch (err3) {
        console.log(`fetchWithMethodFallback: final GET-no-cf failed for ${url} -> ${err3?.message || err3}`);
        // rethrow the original error to be handled by callers
        throw err3;
      }
    }
  }
}

export const HELPER = {
  /**
   * Checks if NPM is accessible
   * @param {Object} options - Request options
   * @returns {Promise<boolean>} true if NPM is accessible
   */
  async isNpmUp({ timeoutMs = 10000 } = {}, env) {
    console.log("COUCOU1");
    if (!env?.NPM_HEALTH_URL) {
      console.log("NPM_HEALTH_URL missing");
      return false;
    }
    const [controller, id] = createTimeoutController(timeoutMs);
    try {
      console.log("COUCOU2");
      console.log("COUCOU8 NPM_HEALTH_URL: " + env.NPM_HEALTH_URL);
      const response = await fetchWithMethodFallback(env.NPM_HEALTH_URL, { signal: controller.signal });
      console.log("COUCOU3");
      if (HELPER.isCloudflareError(response) && response.status >= 520 && response.status <= 529) {
        console.log("COUCOU4");
        return false;
      }
      console.log("COUCOU5 response.status:: " + response.status);
      return response.status > 0 && response.status < 500;
    } catch (err) {
      console.log("COUCOU6 error in isNpmUp:", err?.message || err);
      return false;
    } finally {
      console.log("COUCOU7");
      clearTimeout(id);
    }
  },

  /**
   * Checks if origin is reachable
   * @param {Object} options - Request options
   * @returns {Promise<boolean|null>} Reachability state
   */
  async isOriginReachable({ timeoutMs = 1500 } = {}, env) {
    if (!env?.ORIGIN_PING_URL) return null;
    
    const [controller, id] = createTimeoutController(timeoutMs);
    try {
      console.log("COUCOU1 isOriginReachable");
      console.log("isOriginReachable PING_URL:", env.ORIGIN_PING_URL);
      const response = await fetchWithMethodFallback(env.ORIGIN_PING_URL, { signal: controller.signal });
      console.log("COUCOU1 isOriginReachable response:: " + (response?.status ?? 'no-response'));
      return response && response.status > 0 && response.status < 500;
    } catch (err) {
      console.log("isOriginReachable error:", err?.message || err);
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