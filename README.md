# Espagnol A2 — 500 mots courants

Petite web app de quiz : les 500 mots espagnols les plus courants (niveau CECRL A2)
sont générés via l'API Mistral (`mistral-small-latest`, SDK TypeScript officiel)
avec leur traduction en français. L'interface de chat affiche le mot en français
et tu dois l'écrire en espagnol — **les accents sont ignorés** à la correction.

La clé `MISTRAL_API_KEY` reste côté serveur uniquement (fichier `.env`, jamais envoyé au navigateur).

## Installation

```bash
npm install
cp .env.example .env   # puis édite .env et mets ta clé : MISTRAL_API_KEY=...
```

## Lancer en local

```bash
npm run dev            # avec rechargement auto → http://localhost:3000
```

Ou en production :

```bash
npm run build
npm start              # http://localhost:3000
```

## Fonctionnement

- `GET /api/words` : génère (et met en cache en mémoire) les 500 mots via `mistral-small-latest` au format JSON.
- `POST /api/check` : compare la réponse à la bonne réponse en ignorant casse et accents (normalisation Unicode NFD).
- `public/index.html` : interface de chat minimaliste (aucune dépendance front).
