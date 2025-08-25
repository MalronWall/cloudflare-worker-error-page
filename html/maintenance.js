export default function maintenanceHtml(globalMaintenance, subdomainsMaintenance = [], bannerSubdomains = [], bannerMessage = '') {
  return `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrôle Maintenance</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #181c24 0%, #232a34 100%);
        color: #f5f6fa;
        font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
      }
      .container {
        background: rgba(30, 34, 44, 0.95);
        border-radius: 18px;
        box-shadow: 0 8px 32px 0 rgba(0,0,0,0.25);
        padding: 40px 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 320px;
      }
      h1 {
        font-size: 2rem;
        margin-bottom: 18px;
        letter-spacing: 1px;
      }
      .status {
        margin-bottom: 24px;
        font-size: 1.1rem;
        color: #00e676;
        font-weight: 500;
      }
      .status.inactive {
        color: #ff5252;
      }
      button {
        background: linear-gradient(90deg, #00e676 0%, #00bfae 100%);
        color: #181c24;
        border: none;
        border-radius: 8px;
        padding: 14px 32px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: background 0.2s, transform 0.2s;
      }
      button:hover {
        background: linear-gradient(90deg, #00bfae 0%, #00e676 100%);
        transform: scale(1.05);
      }
      .section {
        width: 100%;
        margin-bottom: 24px;
        padding: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .subdomain-list {
        margin: 16px 0;
      }
      .subdomain-controls {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }
      input {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #666;
        background: rgba(255,255,255,0.1);
        color: white;
      }
      .subdomain-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: rgba(0,0,0,0.2);
        margin: 4px 0;
        border-radius: 4px;
      }
      .remove-btn {
        background: #ff5252;
        padding: 4px 8px;
      }
      .banner-preview {
        background:#ffc; color:#222; padding:12px; text-align:center; border-bottom:1px solid #eee; font-weight:bold; margin:16px 0;
      }
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
        ${bannerMessage ? `<div class="banner-preview">${bannerMessage}</div>` : ''}
        <div style="font-size:0.9em;color:#bbb;margin-top:8px;">Le bandeau s’affiche sur les sous-domaines listés ci-dessus</div>
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