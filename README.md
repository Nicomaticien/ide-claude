# IDE Claude

<p align="center">
  <img src="public/icon.png" alt="Logo IDE Claude" width="96" height="96">
</p>

Éditeur **HTML / CSS** dans le navigateur, avec **aperçu en direct**.
Chaque modification du code se reflète tout de suite dans la prévisualisation.

Aucune base de données, aucun compte : le projet vit dans le navigateur.

## Fonctionnalités

- Mode **HTML + CSS** (deux fichiers) ou **HTML intégré** (CSS dans `<style>`)
- Coloration syntaxique, autocomplétion, repli de code
- Aperçu live, sans rechargement manuel
- Modes desktop / tablette / mobile
- Aperçu plein écran dans un autre onglet (`/preview`), synchronisé
- Sauvegarde automatique (`localStorage`)
- Import de fichiers `.html` / `.css`
- Export d’une page complète ou des deux fichiers séparés
- Interface adaptée au téléphone

## Développement local

```bash
git clone https://github.com/Nicomaticien/ide-claude.git
cd ide-claude
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

Raccourcis :

- `Ctrl/⌘ + S` — forcer la sauvegarde locale
- `Ctrl/⌘ + Shift + Entrée` — ouvrir l’aperçu dans un autre onglet

## Docker

```bash
docker compose up --build
```

L’app écoute sur le port **3000**. Healthcheck : `GET /api/health`.

## Déploiement sur Dokploy

1. Crée une **Application** et connecte ce dépôt.
2. **Build Type** : `Dockerfile`.
3. **Port** : `3000`.
4. Déploie. Aucune variable d’environnement n’est obligatoire.

Dokploy doit exposer le conteneur sur le port `3000`.

## Notes

Le code est stocké dans `localStorage`. Pour garder un projet, utilise **Télécharger**. Pour reprendre un fichier existant, utilise **Importer**.
