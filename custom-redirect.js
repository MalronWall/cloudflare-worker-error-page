import errorTemplate from './html/error-template.html'
import { HELPER } from './helper-functions.js'

const REDIRECT = {
  /**
   * Génère le contenu HTML avec l'URL Canva appropriée
   * @param {string} canvaUrl - L'URL de l'embed Canva
   * @returns {string} Le HTML avec l'URL injectée
   */
  generateErrorPage: (canvaUrl) => {
    return errorTemplate.replace('CANVA_EMBED_URL', canvaUrl);
  }
};

// Constantes pour les statuts HTTP
const STATUS = {
  BOX_NO_IP: 504,
  CONTAINER: 504,
  BOX: 502,
  SERVER: 500,
  MAINTENANCE: 503
};

/**
 * Crée une réponse HTTP avec le contenu et le statut spécifiés
 * @param {string} content - Le contenu HTML de la réponse
 * @param {number} status - Le code de statut HTTP
 * @returns {Response} La réponse formatée
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
 * Gère le mode maintenance du site
 * @param {boolean} isMaintenance - Indique si le mode maintenance est actif
 * @param {Object} env - Variables d'environnement
 * @returns {Promise<Response|null>} Réponse de maintenance ou null
 */
async function handleMaintenanceMode(isMaintenance, env) {
  if (isMaintenance) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_MAINTENANCE_URL), STATUS.MAINTENANCE);
  }
  return null;
}

/**
 * Gère les erreurs de tunnel et de connexion
 * @param {Object} env - Variables d'environnement
 * @returns {Promise<Response>} Réponse appropriée selon le type d'erreur
 */
async function handleTunnelError(env) {
  const originUp = await HELPER.isOriginReachable().catch(() => null);
  if (originUp === false) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_BOX_ERROR_URL), STATUS.BOX_NO_IP);
  }
  
  const npmUp = await HELPER.isNpmUp().catch(() => false);
  if (npmUp) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_CONTAINER_ERROR_URL), STATUS.CONTAINER);
  }
  return makeResponse(REDIRECT.generateErrorPage(env.CANVA_GENERIC_ERROR_URL), STATUS.SERVER);
}

/**
 * Gère les erreurs spécifiques à Cloudflare
 * @param {Response} response - La réponse d'erreur de Cloudflare
 * @param {Object} env - Variables d'environnement
 * @returns {Promise<Response>} Réponse appropriée selon le type d'erreur
 */
async function handleCloudflareError(response, env) {
  const cfCode = await HELPER.getCloudflareErrorCode(response);
  const originUp = await HELPER.isOriginReachable().catch(() => null);

  if (originUp === false) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_BOX_ERROR_URL), STATUS.BOX_NO_IP);
  }

  if (cfCode === 1033 || [502, 521, 522, 524, 525, 526].includes(response.status)) {
    const npmUp = await HELPER.isNpmUp().catch(() => false);
    if (npmUp) {
      return makeResponse(REDIRECT.generateErrorPage(env.CANVA_CONTAINER_ERROR_URL), STATUS.CONTAINER);
    }
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_BOX_ERROR_URL), STATUS.BOX);
  }

  if (response.status === 523) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_BOX_ERROR_URL), STATUS.BOX);
  }

  return makeResponse(REDIRECT.generateErrorPage(env.CANVA_GENERIC_ERROR_URL), STATUS.SERVER);
}

/**
 * Gère les erreurs provenant du serveur d'origine
 * @param {Response} response - La réponse d'erreur du serveur
 * @param {Object} env - Variables d'environnement
 * @returns {Promise<Response>} Réponse appropriée selon le type d'erreur
 */
async function handleOriginError(response, env) {
  const originUp = await HELPER.isOriginReachable().catch(() => null);
  if (originUp === false) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_BOX_ERROR_URL), STATUS.BOX_NO_IP);
  }

  const npmUp = await HELPER.isNpmUp().catch(() => false);
  if (npmUp) {
    return makeResponse(REDIRECT.generateErrorPage(env.CANVA_CONTAINER_ERROR_URL), STATUS.CONTAINER);
  }
  
  return makeResponse(REDIRECT.generateErrorPage(env.CANVA_GENERIC_ERROR_URL), STATUS.SERVER);
}

/**
 * Fonction principale de redirection et gestion des erreurs
 * @param {Request} request - La requête entrante
 * @param {Response|null} response - La réponse du serveur si disponible
 * @param {Error|null} thrownError - L'erreur levée si présente
 * @param {boolean} isMaintenance - État du mode maintenance
 * @param {Object} env - Variables d'environnement
 * @returns {Promise<Response|null>} Réponse d'erreur appropriée ou null
 */
export async function c_redirect(request, response, thrownError = null, isMaintenance = false, env) {
  // Vérification du mode maintenance
  const maintenanceResponse = await handleMaintenanceMode(isMaintenance, env);
  if (maintenanceResponse) return maintenanceResponse;

  // Gestion des erreurs de tunnel
  if (thrownError) {
    return handleTunnelError(env);
  }

  // Gestion des erreurs 5xx
  if (response && response.status >= 500) {
    if (HELPER.isCloudflareError(response)) {
      return handleCloudflareError(response, env);
    } else {
      return handleOriginError(response, env);
    }
  }

  return null;
}
