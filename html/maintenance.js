export default function maintenanceHtml(globalMaintenance, subdomainsMaintenance = []) {
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
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Contrôle Maintenance</h1>
      
      <div class="section">
        <h2>Maintenance Globale</h2>
        <div class="status${globalMaintenance ? '' : ' inactive'}">
          État: <strong>${globalMaintenance ? 'Active' : 'Inactive'}</strong>
        </div>
        <button onclick="fetch('/worker/api/toggle-maintenance/global', {method:'POST'}).then(()=>location.reload())">
          ${globalMaintenance ? 'Désactiver' : 'Activer'} la maintenance globale
        </button>
      </div>

      <div class="section">
        <h2>Maintenance par Sous-domaine</h2>
        <div class="subdomain-list">
          ${subdomainsMaintenance.map(domain => `
            <div class="subdomain-item">
              <span>${domain}</span>
              <button class="remove-btn" onclick="fetch('/worker/api/maintenance/subdomain/remove', {
                method:'POST',
                body: JSON.stringify({subdomain: '${domain}'})
              }).then(()=>location.reload())">Retirer</button>
            </div>
          `).join('')}
        </div>
        <div class="subdomain-controls">
          <input type="text" id="newSubdomain" placeholder="sous-domaine.exemple.fr">
          <button onclick="addSubdomain()">Ajouter</button>
        </div>
      </div>
    </div>
    <script>
      function addSubdomain() {
        const subdomain = document.getElementById('newSubdomain').value;
        if (subdomain) {
          fetch('/worker/api/maintenance/subdomain/add', {
            method: 'POST',
            body: JSON.stringify({subdomain})
          }).then(() => location.reload());
        }
      }
    </script>
  </body>
  </html>`;
}