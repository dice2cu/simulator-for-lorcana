# Simulator for Lorcana — web app

A static React app for entering and saving decks and simulating matchups. Games run locally in browser workers, and saved decks stay in the browser. No backend is needed.

## Run locally

Use Node.js 24 or newer. From the repository root:

```sh
npm ci
cd web
npm ci
npm run dev
```

Open the local URL printed by the dev server.

## Build and test

From `web/`:

```sh
npm test
npm run build
```

The build checks TypeScript and writes the complete site to `web/dist/`, including card data and reference decks. Serve that folder over HTTP rather than opening `index.html` directly. Relative URLs let it work at a domain root or under a repository path.
