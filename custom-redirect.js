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
 * Handles all types of errors and generates appropriate responses
 * @param {Request} request - Incoming request
 * @param {Response|null} response - Server response if available
 * @param {Error|null} thrownError - Thrown error if present
 * @param {boolean} isMaintenance - Maintenance mode state
 * @param {Object} env - Environment variables
 * @returns {Promise<Response|null>} Appropriate error response or null
 */
async function handleError(request, response, thrownError, isMaintenance, env) {
  if (isMaintenance) {
    return makeResponse(
      REDIRECT.generateErrorPage(
        "503",
        env.TEXT_MAINTENANCE_TYPE,
        env.TEXT_MAINTENANCE_MESSAGE,
        env.TEXT_MAINTENANCE_GIF
      ),
      STATUS.MAINTENANCE
    );
  }

  if (thrownError) {
    const originUp = await HELPER.isOriginReachable().catch(() => null);
    if (originUp === false) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_BOX_ERROR_TYPE,
          env.TEXT_BOX_ERROR_MESSAGE,
          env.TEXT_BOX_ERROR_GIF
        ),
        STATUS.BOX_NO_IP
      );
    }

    const npmUp = await HELPER.isNpmUp().catch(() => false);
    if (!npmUp) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_CONTAINER_ERROR_TYPE,
          env.TEXT_CONTAINER_ERROR_MESSAGE,
          env.TEXT_CONTAINER_ERROR_GIF
        ),
        STATUS.CONTAINER
      );
    }

    return makeResponse(
      REDIRECT.generateErrorPage(
        "503",
        env.TEXT_GENERIC_ERROR_TYPE,
        env.TEXT_GENERIC_ERRORR_MESSAGE,
        env.TEXT_GENERIC_ERROR_GIF
      ),
      STATUS.SERVER
    );
  }

  if (response && response.status >= 500) {
    const cfCode = HELPER.isCloudflareError(response)
      ? await HELPER.getCloudflareErrorCode(response)
      : null;

    const originUp = await HELPER.isOriginReachable().catch(() => null);
    if (originUp === false) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_BOX_ERROR_TYPE,
          env.TEXT_BOX_ERROR_MESSAGE,
          env.TEXT_BOX_ERROR_GIF
        ),
        STATUS.BOX_NO_IP
      );
    }

    if (cfCode === 1033 || [502, 521, 522, 524, 525, 526].includes(response.status)) {
      const npmUp = await HELPER.isNpmUp().catch(() => false);
      if (!npmUp) {
        return makeResponse(
          REDIRECT.generateErrorPage(
            "503",
            env.TEXT_CONTAINER_ERROR_TYPE,
            env.TEXT_CONTAINER_ERROR_MESSAGE,
            env.TEXT_CONTAINER_ERROR_GIF
          ),
          STATUS.CONTAINER
        );
      }
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_BOX_ERROR_TYPE,
          env.TEXT_BOX_ERROR_MESSAGE,
          env.TEXT_BOX_ERROR_GIF
        ),
        STATUS.BOX
      );
    }

    if (response.status === 523) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_BOX_ERROR_TYPE,
          env.TEXT_BOX_ERROR_MESSAGE,
          env.TEXT_BOX_ERROR_GIF
        ),
        STATUS.BOX
      );
    }

    return makeResponse(
      REDIRECT.generateErrorPage(
        "503",
        env.TEXT_GENERIC_ERROR_TYPE,
        env.TEXT_GENERIC_ERRORR_MESSAGE,
        env.TEXT_GENERIC_ERROR_GIF
      ),
      STATUS.SERVER
    );
  }

  return null;
}
