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

Create `.env.local` in the project root with emulator-friendly values. See `.env.example` for placeholders:

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

## Secrets Policy

- Never commit `.env`, `.env.*`, Firebase service keys, or any credentials. They are gitignored.
- Use `.env.example` to document required variables with placeholder values.
- If a secret is ever committed, rotate it externally (Firebase Console/API provider) and rewrite history locally before pushing. Run a secret scan (see below).

### Secret Scanning

Integrate a scanner (e.g., `gitleaks`) in CI and pre-commit to prevent regressions. Commands vary by setup; a recommended flow:

1. Install gitleaks: `choco install gitleaks` (Windows) or `brew install gitleaks` (macOS)
2. Scan working tree: `gitleaks detect`
3. Scan history: `gitleaks detect --source . --log-opts="--all"`

If a finding is reported, remove the secret, rotate it, and rerun the scan.

## Design Notes

- **Game-centric**: Games are the primary entity; unit/army state is captured per-game (snapshot) for historical reporting.
- **Drag intents**: One of `insert-before`, `insert-after`, or `attach`. Edge zones choose insert; center (eligible) chooses attach. UI shows exactly one indicator at a time.
- **Eligibility precedence** (centralized in `src/utils/eligibility.js`):
  1. Pairwise Allow
  2. Flags (Can lead / Can be led)
  3. Auto (source data)
- **Override UI**: Compact, collapsed section named `Override` with two checkboxes (Can lead/Can be led), an Allow multi-select with chips, and a Reset. Status chip reads `Overridden (n)` or `Off`.

## Layout

- 3-column grid uses the full viewport width with safe gutters via `padding: 0 clamp(16px, 2vw, 24px)`.
- The page is viewport-locked: the outer app never scrolls; each column scrolls internally.
- Datasheet sits between Player A and Player B. On very small screens, a button opens the Datasheet in an overlay.

## Project Structure

- `src/components/` – React components (`GameSession`, `UnitDatasheet`, etc.)
- `src/utils/` – Utilities (`eligibility.js`, parsing)
- `src/firebase/` – Firebase config and database code

## Notes on Costs

- Development is free using the Firebase emulators.
- Production typically falls within Firebase free tier for small groups.

## Game Session: Three-Column Layout

The in-game view uses a three-column grid layout: `Player A | Datasheet | Player B`.

- Left/Right columns render each player's army as compact, draggable unit cards.
- The center column renders a sticky, scrollable datasheet for the selected unit.
- Columns are implemented in `src/components/GameSession.js` and styled in `src/App.css`.

Key styles and classes:

- `.game-content`: CSS Grid container with 3 columns.
- `.units-sidebar`: Scrollable list container (max-height ~80vh) for unit cards.
- `.game-main`: Sticky datasheet panel (`position: sticky; top: 1rem;`) with internal scroll.

## Army Upload (File or Drag-and-Drop)

Each army column includes:

- A hidden file input: `aria-label="Upload army file for Player A|B"`.
- A visible `.upload-dropzone` area you can click or drag a `.json` file onto.
- Validation errors render inline below the dropzone text.

What happens on upload:

- Files must be `.json`. Invalid types display an inline error such as “Unsupported file type for bad.txt. Please select a .json file.”
- The file is parsed via `parseArmyFile()` which auto-detects simple JSON vs BattleScribe and normalizes to an internal ArmyDocument.
- The normalized army is persisted to Firestore under `playerA.armyData` or `playerB.armyData`.
- Column state is reset for that side: `gameState.columns.<A|B>.attachments` is cleared and a fresh `unitOrder` is generated.

Accessibility:

- Upload targets have ARIA labels and keyboard activation support.
- Error messages are rendered in the dropzone for screen reader discoverability.

## Testing Overview

Run all tests:

```bash
npm run test:ci
```

Highlights:

- Component tests cover the three-column layout and per-column upload flow: `src/components/__tests__/GameSession.layout.test.jsx`.
- `@dnd-kit` is mocked in tests to avoid ESM transform issues in Jest.
- Upload flow tests include positive paths (Player A and Player B) and negative cases (invalid file type, JSON parse errors) with inline error rendering.

Troubleshooting tests:

- If you see issues around unsubscription during unmount, make sure cleanup guards are in place (unsubscribe functions checked before calling). This is already handled in `GameSession`.
- If `@dnd-kit` causes syntax errors under Jest, ensure the mocks at the top of `GameSession.layout.test.jsx` are in place.
