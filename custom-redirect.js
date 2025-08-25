import errorTemplate from './html/error-template.html'
import { HELPER } from './helper-functions.js'

const REDIRECT = {
  /**
   * Generates HTML content with appropriate Canva URL
   * @param {string} canvaUrl - The Canva embed URL
   * @returns {string} The HTML with injected URL
   */
  generateErrorPage: (ERROR_CODE, ERROR_TYPE, ERROR_MESSAGE, ERROR_GIF) => {
    return errorTemplate
    .replace('ERROR_CODE', ERROR_CODE)
    .replace('ERROR_TYPE', ERROR_TYPE)
    .replace('ERROR_MESSAGE', ERROR_MESSAGE)
    .replace('ERROR_GIF', ERROR_GIF);
  }
};

// Constants for HTTP statuses
const STATUS = {
  BOX_NO_IP: 504,
  CONTAINER: 504,
  BOX: 502,
  SERVER: 500,
  MAINTENANCE: 503
};

/**
 * Creates an HTTP response with specified content and status
 * @param {string} content - HTML content for the response
 * @param {number} status - HTTP status code
 * @returns {Response} The formatted response
 */
function makeResponse(content, status) {
  return new Response(content, {
    status,
    headers: {
      'Content-Type': 'text/html',
      'X-Worker-Handled': 'true'
    }
  });
}

/**
 * Handles site maintenance mode
 * @param {boolean} isMaintenance - Indicates if maintenance mode is active
 * @param {Object} env - Environment variables
 * @returns {Promise<Response|null>} Maintenance response or null
 */
async function handleMaintenanceMode(isMaintenance, env) {
  if (isMaintenance) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_MAINTENANCE_TYPE, env.TEXT_MAINTENANCE_MESSAGE, env.TEXT_MAINTENANCE_GIF), STATUS.MAINTENANCE);
  }
  return null;
}

/**
 * Handles tunnel and connection errors
 * @param {Object} env - Environment variables
 * @returns {Promise<Response>} Appropriate response based on error type
 */
async function handleTunnelError(env) {
  const originUp = await HELPER.isOriginReachable().catch(() => null);
  if (originUp === false) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_BOX_ERROR_TYPE, env.TEXT_BOX_ERROR_MESSAGE, env.TEXT_BOX_ERROR_GIF), STATUS.BOX_NO_IP);
  }
  
  const npmUp = await HELPER.isNpmUp().catch(() => false);
  if (npmUp) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_CONTAINER_ERROR_TYPE, env.TEXT_CONTAINER_ERROR_MESSAGE, env.TEXT_CONTAINER_ERROR_GIF), STATUS.CONTAINER);
  }
  return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_GENERIC_ERROR_TYPE, env.TEXT_GENERIC_ERROR_MESSAGE, env.TEXT_GENERIC_ERROR_GIF), STATUS.SERVER);
}

/**
 * Handles Cloudflare specific errors
 * @param {Response} response - Cloudflare error response
 * @param {Object} env - Environment variables
 * @returns {Promise<Response>} Appropriate response based on error type
 */
async function handleCloudflareError(response, env) {
  const cfCode = await HELPER.getCloudflareErrorCode(response);
  const originUp = await HELPER.isOriginReachable().catch(() => null);

  if (originUp === false) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_BOX_ERROR_TYPE, env.TEXT_BOX_ERROR_MESSAGE, env.TEXT_BOX_ERROR_GIF), STATUS.BOX_NO_IP);
  }

  if (cfCode === 1033 || [502, 521, 522, 524, 525, 526].includes(response.status)) {
    const npmUp = await HELPER.isNpmUp().catch(() => false);
    if (npmUp) {
      return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_CONTAINER_ERROR_TYPE, env.TEXT_CONTAINER_ERROR_MESSAGE, env.TEXT_CONTAINER_ERRORE_GIF), STATUS.CONTAINER);
    }
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_BOX_ERROR_TYPE, env.TEXT_BOX_ERROR_MESSAGE, env.TEXT_BOX_ERROR_GIF), STATUS.BOX);
  }

  if (response.status === 523) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_BOX_ERROR_TYPE, env.TEXT_BOX_ERROR_MESSAGE, env.TEXT_BOX_ERROR_GIF), STATUS.BOX);
  }

  return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_GENERIC_ERROR_TYPE, env.TEXT_GENERIC_ERROR_MESSAGE, env.TEXT_GENERIC_ERROR_GIF), STATUS.SERVER);
}

/**
 * Handles errors from origin server
 * @param {Response} response - Origin server error response
 * @param {Object} env - Environment variables
 * @returns {Promise<Response>} Appropriate response based on error type
 */
async function handleOriginError(response, env) {
  const originUp = await HELPER.isOriginReachable().catch(() => null);
  if (originUp === false) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_BOX_ERROR_TYPE, env.TEXT_BOX_ERROR_MESSAGE, env.TEXT_BOX_ERROR_GIF), STATUS.BOX_NO_IP);
  }

  const npmUp = await HELPER.isNpmUp().catch(() => false);
  if (npmUp) {
    return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_CONTAINER_ERROR_TYPE, env.TEXT_CONTAINER_ERROR_MESSAGE, env.TEXT_CONTAINER_ERROR_GIF), STATUS.CONTAINER);
  }
  
  return makeResponse(REDIRECT.generateErrorPage("503", env.TEXT_GENERIC_ERROR_TYPE, env.TEXT_GENERIC_ERROR_MESSAGE, env.TEXT_GENERIC_ERROR_GIF), STATUS.SERVER);
}

/**
 * Main redirection and error handling function
 * @param {Request} request - Incoming request
 * @param {Response|null} response - Server response if available
 * @param {Error|null} thrownError - Thrown error if present
 * @param {boolean} isMaintenance - Maintenance mode state
 * @param {Object} env - Environment variables
 * @returns {Promise<Response|null>} Appropriate error response or null
 */
export async function c_redirect(request, response, thrownError = null, isMaintenance = false, env) {
  // Check maintenance mode
  const maintenanceResponse = await handleMaintenanceMode(isMaintenance, env);
  if (maintenanceResponse) return maintenanceResponse;

  // Handle tunnel errors
  if (thrownError) {
    return handleTunnelError(env);
  }

  // Handle 5xx errors
  if (response && response.status >= 500) {
    if (HELPER.isCloudflareError(response)) {
      return handleCloudflareError(response, env);
    } else {
      return handleOriginError(response, env);
    }
  }

  return null;
}
