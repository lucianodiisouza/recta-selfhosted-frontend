# Recta Web

Web frontend for Recta — personal finance manager with household support. **Open source & self-hostable.**

## About this project

Recta is an open source personal finance manager. This repository is the public web app: **anyone can self-host it**, fork it, submit pull requests, or build on top of it. Submitting PRs or contributing does **not** guarantee that any feature or change will be incorporated into the hosted product at [recta.app](https://recta.app). The maintainers decide what is merged here or can be shipped on recta.app.

This project is maintained by [PrimoDev](https://www.oprimo.dev).

**Other part of the project:** [recta-selfhosted-backend](https://github.com/oprimodev/recta-selfhosted-backend) — API (Node.js/Fastify).

## Tech stack

- **React 18** + **TypeScript**
- **Vite** – build
- **Tailwind CSS** – styling
- **Firebase** – auth (Google, email)
- **React Query** – server state
- **Recharts** – charts

## Hosting (self-hosted)

You can serve the built frontend from any static host. Build with `npm run build` and set `VITE_API_BASE_URL` to your backend URL. Some options:

- **[Vercel](https://vercel.com)** – static sites, env vars, preview deploys
- **[Netlify](https://netlify.com)** – static hosting, env vars, redirects
- **[Cloudflare Pages](https://pages.cloudflare.com)** – free tier, global CDN
- **Any static host** – upload the `dist/` folder; ensure API URL is set at build time

Use the same Firebase project as your backend and restrict allowed domains in the Firebase Console.

## How to run

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- Recta backend running (e.g. from `recta-public-backend` or your own deploy)
- Firebase project with Authentication enabled (same project as the backend)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Firebase config and backend URL:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Analytics (optional) |
| `VITE_API_BASE_URL` | Yes | Backend URL, e.g. `http://localhost:3000` |
| `VITE_SENTRY_DSN` | No | Sentry (optional) |
| `VITE_FLAG_MAINTENANCE` | No | `true` for maintenance mode |
| `VITE_PREMIUM_FOR_ALL_USERS` | No | Feature flag (optional) |

Firebase keys: [Firebase Console](https://console.firebase.google.com) → Project → Project settings → Your apps.

### 3. Start the frontend

**Development:**

```bash
npm run dev
```

Open `http://localhost:5173` (or the port Vite shows).

**Production:**

```bash
npm run build
npm run preview
```

Output is in `dist/`. Serve with any static server (Nginx, Vercel, etc.) and set the API URL via `VITE_API_BASE_URL` at build time.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Lint |
| `npm test` | Unit tests (Vitest) |
| `npm run check:tsc` | Type check; fails only on errors not in `tsc-baseline.txt` |

## Features

- Dashboard with charts and summaries
- Accounts, transactions, categories
- Budgets and savings goals
- Recurring transactions
- Households (share with others)
- Light/dark theme and multiple languages (PT-BR, EN, ES, FR, etc.)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the checks that must pass before a push, and the pull request rules. User-facing changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

MIT
