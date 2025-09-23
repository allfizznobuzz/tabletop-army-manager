# Tabletop Army Manager

A modern, game-centric app to run tabletop games with live unit management, attachments, damage, and victory points powered by Firebase and the Firebase emulators.

## Quick Start (Emulator-Friendly)

### Prerequisites
- Node.js 18+
- NPM (or PNPM/Yarn)
- Firebase CLI: `npm i -g firebase-tools`
- Java JRE (required for Firebase Emulators)

### 1) Install dependencies
```bash
npm install
```

### 2) Environment (.env.local)
Create `.env.local` in the project root with emulator-friendly values:
```
REACT_APP_USE_EMULATORS=true
REACT_APP_FIREBASE_API_KEY=demo
REACT_APP_FIREBASE_AUTH_DOMAIN=localhost
REACT_APP_FIREBASE_PROJECT_ID=demo-project
REACT_APP_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=1234567890
REACT_APP_FIREBASE_APP_ID=1:1234567890:web:demo
```

### 3) Start emulators and app
Use two terminals:
```bash
# Terminal 1
npm run firebase:emulators

# Terminal 2
npm start
```
Default dev server: http://localhost:3000

### 4) Seed sample data (optional)
Add a sample army JSON in the UI or load from BattleScribe; the app auto-detects and converts.

## Scripts
- `npm start` – Run React app (CRA)
- `npm test` – Run unit/component tests (Jest)
- `npm run firebase:emulators` – Start Firebase emulators (auth/firestore/storage as configured)
- `npm run firebase:deploy` – Build and deploy

## Testing

### Unit
```bash
npm test
```
Included: `src/utils/eligibility.test.js` (override logic and precedence).

### Component (RTL) & E2E (Cypress/Playwright)
- Suggested next steps (not yet installed):
  - Edge vs center zones for drag intent
  - Badge not overlapping title
  - List spacing stable while dragging
  - Constrained drag outside list snaps back

## Troubleshooting
- Ports in use: stop previous `npm start` or emulators; or change ports via `.firebaserc` / `firebase.json`.
- Emulator data stale: stop emulators and delete the local `.firebase/` directory to reset.
- White screen: check `.env.local`, console for Firebase emulator connection logs.
- CSS jitters while dragging: verify `.units-sidebar { overflow-y: auto; }` and that `@dnd-kit` modifiers include `restrictToFirstScrollableAncestor`.

## Design Notes

- **Game-centric**: Games are the primary entity; unit/army state is captured per-game (snapshot) for historical reporting.
- **Drag intents**: One of `insert-before`, `insert-after`, or `attach`. Edge zones choose insert; center (eligible) chooses attach. UI shows exactly one indicator at a time.
- **Eligibility precedence** (centralized in `src/utils/eligibility.js`):
  1) Pairwise Allow
  2) Flags (Can lead / Can be led)
  3) Auto (source data)
- **Override UI**: Compact, collapsed section named `Override` with two checkboxes (Can lead/Can be led), an Allow multi-select with chips, and a Reset. Status chip reads `Overridden (n)` or `Off`.

## Project Structure

- `src/components/` – React components (`GameSession`, `UnitDatasheet`, etc.)
- `src/utils/` – Utilities (`eligibility.js`, parsing)
- `src/firebase/` – Firebase config and database code

## Notes on Costs
- Development is free using the Firebase emulators.
- Production typically falls within Firebase free tier for small groups.
