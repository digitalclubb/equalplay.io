# EqualPlay

Fair player rotations for youth team sports. A mobile-first web app that helps coaches manage substitutions, handle late arrivals and injuries, and ensure every player gets balanced playing time.

## Features

- **Fair rotation generation** — fairness-debt algorithm ensures balanced play time across all players
- **Live match management** — mark players as late, injured, or leaving early during games
- **Auto-substitution** — injured players are automatically subbed off with the fairest replacement
- **Multi-team support** — manage multiple teams independently in a single session
- **Game progression** — advance through games with locked past lineups and rebalanced future games
- **Offline-ready** — PWA with service worker, works without internet after first load
- **Persistent state** — automatically saves to localStorage, restores on reload

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173 in a mobile browser (or use device emulation).

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start development server with HMR |
| `pnpm build` | Type-check and build for production |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run OXC linter |
| `pnpm preview` | Preview production build locally |

## Tech stack

- **TypeScript** (strict mode, no framework)
- **Vite** (build tool)
- **Vitest** (testing, 61 tests)
- **OXC** (linting)
- **pnpm** (package manager)

## How it works

1. **Add players** — enter player names in the squad panel
2. **Configure** — set players per team and number of matches
3. **Generate** — tap "Generate rotation" to create the plan
4. **Manage live** — tap player chips to mark late/injured/leaving, use "Make sub" for substitutions
5. **Advance games** — tap "Start game N" to progress through the session

The fairness algorithm tracks each player's actual play time against their expected fair share, and aggressively rebalances future games to compensate for disruptions.

## Deployment

Static site — deploy the `dist/` folder to any host. Configured for Vercel.

```bash
pnpm build
# Output in dist/
```

## Licence

ISC
