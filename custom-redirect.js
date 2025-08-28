import errorTemplate from './html/error-template.html'
import { HELPER } from './helper-functions.js'

// Default error values, will be set in c_redirect using env
let errorCode = "500";
let errorType = "";
let errorMessage = "";
let errorGif = "";

const REDIRECT = {
  /**
   * Generates HTML content with appropriate Canva URL
   * @returns {string} The HTML with injected URL
   */
  generateErrorPage: () => {
    return errorTemplate
    .replace('ERROR_CODE', this.errorCode)
    .replace('ERROR_TYPE', this.errorType)
    .replace('ERROR_MESSAGE', this.errorMessage)
    .replace('ERROR_GIF', this.errorGif);
  }
};


/**
 * Creates an HTTP response with specified content
 * @param {string} content - HTML content for the response
 * @returns {Response} The formatted response
 */
function makeResponse(content) {
  return new Response(content, {
    status: this.errorCode,
    headers: {
      'Content-Type': 'text/html',
      'X-Worker-Handled': 'true'
    }
  });
}

function getErrorDetailsFromCfCode(cfCode, env) {
  if(cfCode == "MAINTENANCE") {
    this.errorCode = "503";
    this.errorType = env.TEXT_MAINTENANCE_TYPE;
    this.errorMessage = env.TEXT_MAINTENANCE_MESSAGE;
    this.errorGif = env.TEXT_MAINTENANCE_GIF;
    return;
  }
  this.errorCode = cfCode ? cfCode.toString() : "500";
  if (env.TEXT_CONTAINER_ERROR_CODE.includes(cfCode)) {
    this.errorType = env.TEXT_CONTAINER_ERROR_TYPE;
    this.errorMessage = env.TEXT_CONTAINER_ERROR_MESSAGE;
    this.errorGif = env.TEXT_CONTAINER_ERROR_GIF;
  } else if (env.TEXT_BOX_ERROR_CODE.includes(cfCode)) {
    this.errorType = env.TEXT_BOX_ERROR_TYPE;
    this.errorMessage = env.TEXT_BOX_ERROR_MESSAGE;
    this.errorGif = env.TEXT_BOX_ERROR_GIF;
  }
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
  // Set default error details using env inside the function
  errorType = env.TEXT_GENERIC_ERROR_TYPE;
  errorMessage = env.TEXT_GENERIC_ERROR_MESSAGE;
  errorGif = env.TEXT_GENERIC_ERROR_GIF;

  // Maintenance mode
  if (isMaintenance) {
    getErrorDetailsFromCfCode("MAINTENANCE", env, true);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  const originUp = await HELPER.isOriginReachable(undefined, env).catch(() => null);
  const npmUp = await HELPER.isNpmUp(undefined, env).catch(() => false);

  // Internet down
  if(!originUp) {
    getErrorDetailsFromCfCode(504, env);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  // NPM down so all services down
  if(npmUp) {
    // it's the default message so no need to change anything
  }

  console.log("thrownError:", thrownError);
  console.log("response.status:", response.status);

  // Handle zero trust errors
  if(thrownError && thrownError == 1033) {
    getErrorDetailsFromCfCode(502, env);
    return makeResponse(REDIRECT.generateErrorPage());
  }
  if(thrownError && thrownError == 1101) {
    getErrorDetailsFromCfCode(502, env);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  // Handle server errors (5xx)
  if(response && response.status >= 500) {
    getErrorDetailsFromCfCode(response.status, env);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  return null;
}
