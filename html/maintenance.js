export default function maintenanceHtml(globalMaintenance, subdomainsMaintenance = [], bannerSubdomains = [], bannerMessage = '') {
  return `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrôle Maintenance</title>
    <style>
      /* Styles existants... */
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Contrôle Maintenance</h1>
      <div class="section">
        <div class="status ${globalMaintenance ? '' : 'inactive'}">
          Maintenance globale: ${globalMaintenance ? 'active' : 'inactive'}
        </div>
        <button onclick="toggleGlobal()">Basculer l'état global</button>
      </div>
      <div class="section">
        <h2>Sous-domaines en maintenance</h2>
        <div class="subdomain-list">
          ${subdomainsMaintenance.map(sd => `<div class="subdomain-item">${sd} <button class="remove-btn" onclick="removeSubdomain('${sd}')">Retirer</button></div>`).join('')}
        </div>
        <div class="subdomain-controls">
          <input id="subdomain-input" placeholder="Ajouter un sous-domaine" />
          <button onclick="addSubdomain()">Ajouter</button>
        </div>
      </div>
      <div class="section">
        <h2>Bandeau personnalisé</h2>
        <div>
          <label for="banner-message">Message du bandeau :</label>
          <input id="banner-message" value="${bannerMessage.replace(/"/g, '&quot;')}" />
          <button onclick="setBannerMessage()">Mettre à jour</button>
        </div>
        <div>
          <label for="banner-subdomains">Sous-domaines du bandeau (séparés par une virgule) :</label>
          <input id="banner-subdomains" value="${bannerSubdomains.join(',')}" />
          <button onclick="setBannerSubdomains()">Mettre à jour</button>
        </div>
      </div>
    </div>
    <script>
      async function toggleGlobal() {
        await fetch('/worker/api/toggle-maintenance/global', { method: 'POST' });
        location.reload();
      }
      async function addSubdomain() {
        const val = document.getElementById('subdomain-input').value.trim();
        if (!val) return;
        await fetch('/worker/api/maintenance/subdomain/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: val })
        });
        location.reload();
      }
      async function removeSubdomain(sd) {
        await fetch('/worker/api/maintenance/subdomain/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: sd })
        });
        location.reload();
      }
      async function setBannerMessage() {
        const val = document.getElementById('banner-message').value;
        await fetch('/worker/api/banner/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: val })
        });
        location.reload();
      }
      async function setBannerSubdomains() {
        const val = document.getElementById('banner-subdomains').value.split(',').map(s => s.trim()).filter(Boolean);
        await fetch('/worker/api/banner/subdomains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomains: val })
        });
        location.reload();
      }
    </script>
  </body>
  </html>`;
}