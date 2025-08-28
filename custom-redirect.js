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
 * Main redirection and error handling function
 * @param {Request} request - Incoming request
 * @param {Response|null} response - Server response if available
 * @param {Error|null} thrownError - Thrown error if present
 * @param {boolean} isMaintenance - Maintenance mode state
 * @param {Object} env - Environment variables
 * @returns {Promise<Response|null>} Appropriate error response or null
 */
export async function c_redirect(request, response, thrownError = null, isMaintenance = false, env) {
  // Maintenance mode
  if (isMaintenance) {
    return makeResponse(
      REDIRECT.generateErrorPage(
        "503",
        env.TEXT_MAINTENANCE_TYPE,
        env.TEXT_MAINTENANCE_MESSAGE+ "<br> isMaintenance: " + isMaintenance + "<br> COUCOU1",
        env.TEXT_MAINTENANCE_GIF
      ),
      STATUS.MAINTENANCE
    );
  }

  // Tunnel error (thrownError)
  else if (thrownError) {
    const originUp = await HELPER.isOriginReachable(undefined, env).catch(() => null);
    if (originUp === false) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_BOX_ERROR_TYPE,
          env.TEXT_BOX_ERROR_MESSAGE+ "<br> originUp: " + originUp + "<br> COUCOU2",
          env.TEXT_BOX_ERROR_GIF
        ),
        STATUS.BOX_NO_IP
      );
    }
    const npmUp = await HELPER.isNpmUp(undefined, env).catch(() => false);
    if (!npmUp) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_CONTAINER_ERROR_TYPE,
          env.TEXT_CONTAINER_ERROR_MESSAGE+ "<br> originUp: " + originUp+ "<br> npmUp: " + npmUp + "<br> COUCOU3",
          env.TEXT_CONTAINER_ERROR_GIF
        ),
        STATUS.CONTAINER
      );
    }
    return makeResponse(
      REDIRECT.generateErrorPage(
        "503",
        env.TEXT_GENERIC_ERROR_TYPE,
        env.TEXT_GENERIC_ERRORR_MESSAGE+ "<br> originUp: " + originUp+ "<br> npmUp: " + npmUp + "<br> COUCOU4",
        env.TEXT_GENERIC_ERROR_GIF
      ),
      STATUS.SERVER
    );
  }

  // 5xx error response
  else if (response && response.status >= 500) {
    const originUp = await HELPER.isOriginReachable(undefined, env).catch(() => null);
    console.log("COUCOU1 originUp:: " + originUp);
    if (originUp === false) {
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_BOX_ERROR_TYPE,
          env.TEXT_BOX_ERROR_MESSAGE + "<br> originUp: " + originUp + "<br> COUCOU5",
          env.TEXT_BOX_ERROR_GIF
        ),
        STATUS.BOX_NO_IP
      );
    }

    if (HELPER.isCloudflareError(response)) {
      const cfCode = await HELPER.getCloudflareErrorCode(response);
      if (response.status === 502) {
        return makeResponse(
          REDIRECT.generateErrorPage(
            response.status.toString(),
            env.TEXT_CONTAINER_ERROR_TYPE,
            env.TEXT_CONTAINER_ERROR_MESSAGE + "<br> cfCode: " + cfCode + "<br> response.status: " + response.status+ "<br> originUp: " + originUp + "<br> COUCOU8",
            env.TEXT_CONTAINER_ERROR_GIF
          ),
          STATUS.BOX
        );
      }
      if (response.status === 523) {
        return makeResponse(
          REDIRECT.generateErrorPage(
            "503",
            env.TEXT_BOX_ERROR_TYPE,
            env.TEXT_BOX_ERROR_MESSAGE + "<br> cfCode: " + cfCode + "<br> response.status: " + response.status+ "<br> originUp: " + originUp + "<br> COUCOU8",
            env.TEXT_BOX_ERROR_GIF
          ),
          STATUS.BOX
        );
      }
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_GENERIC_ERROR_TYPE,
          env.TEXT_GENERIC_ERRORR_MESSAGE + "<br> cfCode: " + cfCode + "<br> response.status: " + response.status+ "<br> originUp: " + originUp + "<br> COUCOU9",
          env.TEXT_GENERIC_ERROR_GIF
        ),
        STATUS.SERVER
      );
    } else {
      const npmUp = await HELPER.isNpmUp(undefined, env).catch(() => false);
      if (!npmUp) {
        return makeResponse(
          REDIRECT.generateErrorPage(
            "503",
            env.TEXT_CONTAINER_ERROR_TYPE,
            env.TEXT_CONTAINER_ERROR_MESSAGE + "<br> npmUp: " + npmUp+ "<br> originUp: " + originUp + "<br> COUCOU10",
            env.TEXT_CONTAINER_ERROR_GIF
          ),
          STATUS.CONTAINER
        );
      }
      return makeResponse(
        REDIRECT.generateErrorPage(
          "503",
          env.TEXT_GENERIC_ERROR_TYPE,
          env.TEXT_GENERIC_ERRORR_MESSAGE + "<br> npmUp: " + npmUp + "<br> originUp: " + originUp + "<br> COUCOU11",
          env.TEXT_GENERIC_ERROR_GIF
        ),
        STATUS.SERVER
      );
    }
  }

  // No error
  else {
    return null;
  }
}
