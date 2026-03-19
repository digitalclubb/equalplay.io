# CLAUDE.md — Project instructions for Claude

## Project

Equal Play — a mobile-first web app for youth sports coaches to generate fair player rotations and manage live match-day substitutions.

## Tech stack

- TypeScript (strict mode)
- Vite (build tool)
- Vanilla DOM (no framework)
- OXC (linting)
- Vitest (testing)
- pnpm (package manager)

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Type-check + production build
pnpm test         # Run all tests (vitest)
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Run OXC linter
```

## IMPORTANT: Run tests when changing core logic

**Always run `pnpm test` after modifying any file in:**
- `src/logic/` (rotation.ts, validate.ts, storage.ts)
- `src/types/index.ts`

These files contain the fairness algorithm, validation rules, and persistence logic. The test suite (61 tests) covers all critical paths including:
- Fair rotation generation and distribution
- Late player arrival and reintegration (critical bug was fixed here)
- Injury handling with auto-substitution
- Leaving early (partial availability)
- Substitution swaps
- Fairness debt recovery
- Storage round-trip, legacy migration, and corruption handling
- Input validation edge cases

**Do not skip tests.** A past bug where late+joined players were permanently benched after game advancement was only caught by the test `"joined player stays on field after game advances"`.

## Architecture

```
src/
  types/index.ts          # All domain types and interfaces
  logic/
    rotation.ts           # Fairness algorithm (generateInitialPlan, applyEvents)
    validate.ts           # Input validation
    storage.ts            # localStorage persistence (multi-team)
  components/
    form.ts               # Squad panel + match settings
    playerList.ts         # Dynamic player input list
    results.ts            # Game cards, chips, action sheet, fairness summary
    teamTabs.ts           # Multi-team tab switching
    toast.ts              # Toast notifications
    logo.ts               # SVG logo
  app.ts                  # Main app orchestration and state
  main.ts                 # Entry point
  __tests__/
    rotation.test.ts      # 36 tests — rotation logic
    validate.test.ts      # 14 tests — input validation
    storage.test.ts       # 11 tests — persistence
```

## Key design decisions

### Fairness algorithm (rotation.ts)

Uses a **fairness debt** model:
- `fairnessDebt = (gamesAvailable * fairRate) - playTimeUnits`
- Players with highest debt (most underplayed) get selected first
- Tie-break: longest since last played

**Two-phase event application:**
- Phase 1: Past games (before currentGame) — locked lineups, late+joined players excluded
- Phase 2: Current + future games — fully rebalanced, all available players eligible

**Critical invariant:** Late+joined players must be excluded from Phase 1 (past games they missed) but FULLY eligible in Phase 2 (current and future games). The `gameNumber === currentGame` exclusion was removed because it caused the "permanent bench" bug when advancing games.

### Play time units

- Full game on field = 1.0
- Subbed on mid-game = 0.5
- Subbed off mid-game = 0.5
- On bench = 0.0

### Multi-team state

Each team has independent state (players, plan, events, currentGame). Teams are stored as an array in localStorage under `equalplay_teams`. Legacy single-team data under `equalplay_state` is auto-migrated on first load.

## Code style

- British English in UI copy (no Oxford commas)
- Sentence case for labels (not ALL CAPS)
- `esc()` function used for all user-supplied text in innerHTML
- No framework — vanilla DOM manipulation
- No external CSS frameworks
- System font stack throughout
