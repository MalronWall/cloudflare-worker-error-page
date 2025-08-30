import errorTemplate from './html/error-template.html'
import { HELPER } from './helper-functions.js'

// Default error values, will be set in c_redirect using env
let errorCode = "500";
let errorType = "";
let errorMessage = "";
let errorGif = "";
let enableReportError = false;
let reportErrorButtonText = 'Signaler cette erreur';
let reportErrorModalHeaderText  = "🆘 Signalez-moi l'erreur"
let reportErrorLabelPlaceholder  = "Nom / Pseudo"
let reportErrorModalNamePlaceholder  = "Ex : Jane Doe"
let reportErrorCancelButtonText  = "Annuler"
let reportErrorSubmitButtonText  = "Signaler"
let reportErrorSuccessMessage  = "Merci pour votre signalement ! 🙏"
let reportErrorFailureMessage  = "Une erreur est survenue lors de l'envoi du signalement. 😞"

const REDIRECT = {
  /**
   * Generates HTML content with appropriate Canva URL
   * @returns {string} The HTML with injected URL
   */
  generateErrorPage: () => {
    return errorTemplate
    .replace('ERROR_CODE', errorCode)
    .replace('ERROR_TYPE', errorType)
    .replace('ERROR_MESSAGE', errorMessage)
    .replace('ERROR_GIF', errorGif)
    .replace('ENABLE_REPORT_ERROR', enableReportError)
    .replace('REPORT_ERROR_BUTTON_TEXT', reportErrorButtonText)
    .replace('REPORT_ERROR_MODAL_HEADER_TEXT', reportErrorModalHeaderText)
    .replace('REPORT_ERROR_LABEL_PLACEHOLDER', reportErrorLabelPlaceholder)
    .replace('REPORT_ERROR_MODAL_NAME_PLACEHOLDER', reportErrorModalNamePlaceholder)
    .replace('REPORT_ERROR_CANCEL_BUTTON_TEXT', reportErrorCancelButtonText)
    .replace('REPORT_ERROR_SUBMIT_BUTTON_TEXT', reportErrorSubmitButtonText)
    .replace('REPORT_ERROR_SUCCESS_MESSAGE', reportErrorSuccessMessage)
    .replace('REPORT_ERROR_FAILURE_MESSAGE', reportErrorFailureMessage)
    .replace('REPORT_ERROR_CODE', errorCode);
  }
};


/**
 * Creates an HTTP response with specified content
 * @param {string} content - HTML content for the response
 * @returns {Response} The formatted response
 */
function makeResponse(content) {
  return new Response(content, {
    status: errorCode,
    headers: {
      'Content-Type': 'text/html',
      'X-Worker-Handled': 'true'
    }
  });
}

function getErrorDetailsFromCfCode(cfCode, env) {
  if(cfCode == "MAINTENANCE") {
    errorCode = "503";
    errorType = env.TEXT_MAINTENANCE_TYPE;
    errorMessage = env.TEXT_MAINTENANCE_MESSAGE;
    errorGif = env.TEXT_MAINTENANCE_GIF;
    return;
  }
  errorCode = cfCode ? cfCode.toString() : "500";
  enableReportError = env.ENABLE_REPORT_ERROR;
  if(enableReportError) {
    reportErrorButtonText = env.REPORT_ERROR_BUTTON_TEXT
    reportErrorModalHeaderText  = env.REPORT_ERROR_MODAL_HEADER_TEXT
    reportErrorLabelPlaceholder  = env.REPORT_ERROR_LABEL_PLACEHOLDER
    reportErrorModalNamePlaceholder  = env.REPORT_ERROR_MODAL_NAME_PLACEHOLDER
    reportErrorCancelButtonText  = env.REPORT_ERROR_CANCEL_BUTTON_TEXT
    reportErrorSubmitButtonText  = env.REPORT_ERROR_SUBMIT_BUTTON_TEXT
    reportErrorSuccessMessage  = env.REPORT_ERROR_SUCCESS_MESSAGE
    reportErrorFailureMessage  = env.REPORT_ERROR_FAILURE_MESSAGE
  }

  if (env.TEXT_CONTAINER_ERROR_CODE.includes(cfCode)) {
    errorType = env.TEXT_CONTAINER_ERROR_TYPE;
    errorMessage = env.TEXT_CONTAINER_ERROR_MESSAGE;
    errorGif = env.TEXT_CONTAINER_ERROR_GIF;
  } else if (env.TEXT_BOX_ERROR_CODE.includes(cfCode)) {
    errorType = env.TEXT_BOX_ERROR_TYPE;
    errorMessage = env.TEXT_BOX_ERROR_MESSAGE;
    errorGif = env.TEXT_BOX_ERROR_GIF;
  } else if (env.TEXT_TUNNEL_ERROR_CODE.includes(cfCode)) {
    errorType = env.TEXT_TUNNEL_ERROR_TYPE;
    errorMessage = env.TEXT_TUNNEL_ERROR_MESSAGE;
    errorGif = env.TEXT_TUNNEL_ERROR_GIF;
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
    getErrorDetailsFromCfCode("MAINTENANCE", env);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  const originUp = await HELPER.isOriginReachable(undefined, env).catch(() => null);
  //const npmUp = await HELPER.isNpmUp(undefined, env).catch(() => false);

  // Internet down
  if(!originUp) {
    getErrorDetailsFromCfCode(504, env);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  /*
  // NPM down so all services down
  if(!npmUp) {
    // it's the default message so no need to change anything
  } */

  // Handle server errors (5xx)
  if(response && response.status >= 500) {
    getErrorDetailsFromCfCode(response.status, env);
    return makeResponse(REDIRECT.generateErrorPage());
  }

  return null;
}
