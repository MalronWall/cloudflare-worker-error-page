# Cloudflare Worker Error Page

Ce projet permet de déployer une page d'erreur personnalisée via un Worker Cloudflare.

## Étapes d'installation

### 1. Créer un Worker sur Cloudflare

- Connectez-vous à votre dashboard Cloudflare.
- Allez dans la section **Workers**.
- Créez un nouveau Worker.
- Configurez la route sur votre domaine principal comme ceci : *kanago.fr/*

### 2. Forker ce dépôt


### 3. Lier le Worker à ce dépôt

- Dans le dashboard Cloudflare, liez le Worker créé à votre repo forker

### 4. Activer les variables d'environnement

- Ouvrez le fichier `wrangler.toml`.
- Retirez les `#` devant les variables à activer, ou ajoutez-les en tant que **secrets** dans Cloudflare (section Variables/Secrets du Worker).
- A la place vous pouvez aussi laissez les `#` mais ajouter les variables en tant que secrets dans le Worker

### 5. Créer un namespace KV

- Dans Cloudflare, allez dans **Workers > KV**.
- Créez un namespace nommé :  
  ```
  cloudflare-worker-error-page
  ```
- Copiez l'ID du namespace et ajoutez-le dans le champ `id` de la section `kv_namespaces` du fichier `wrangler.toml`.

### 6. Déployer le Worker

Si vous avez bien lier votre repo forker a votre Worker cloudflare il ve se deployer automatiquement a chaque modification

## Notes

- Les URLs Canva pour les pages d'erreur sont configurables dans `wrangler.toml`.
