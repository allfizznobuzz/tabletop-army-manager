import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
// NOTE: GameSession is required after jest.mock declarations below

// Mock dnd-kit to avoid ESM issues in Jest
jest.mock("@dnd-kit/core", () => ({
  __esModule: true,
  DndContext: ({ children }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: jest.fn(),
  PointerSensor: function PointerSensor() {},
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn((...args) => args),
  DragOverlay: ({ children }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
}));
jest.mock("@dnd-kit/modifiers", () => ({
  __esModule: true,
  restrictToVerticalAxis: jest.fn(),
  restrictToFirstScrollableAncestor: jest.fn(),
}));
jest.mock("@dnd-kit/sortable", () => ({
  __esModule: true,
  SortableContext: ({ children }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: (arr) => arr,
}));
jest.mock("@dnd-kit/utilities", () => ({
  __esModule: true,
  CSS: { Transform: { toString: () => "" } },
}));

// Minimal firebase mock with a single A unit and optional B target
const makeGameDoc = (withTarget = false) => ({
  id: "game-panel",
  name: "Attack Helper Panel Test",
  currentTurn: "user-1",
  playerA: {
    displayName: "Player A",
    armyData: {
      units: [
        {
          name: "Test Squad",
          models: 3,
          toughness: 4,
          armor_save: "3+",
          ballistic_skill: 3,
          weapon_skill: 4,
          weapons: [
            {
              name: "Bolt rifle",
              range: '24"',
              type: "Rapid Fire 1",
              attacks: "D6+1",
              skill: 3,
              strength: 4,
              ap: -1,
              damage: 2,
            },
          ],
        },
      ],
    },
  },
  playerB: {
    displayName: "Player B",
    armyData: {
      units: withTarget
        ? [
            {
              name: "Enemy",
              models: 5,
              wounds: 1,
              toughness: 5,
              armor_save: "3+",
              invulnerable_save: "5+",
              weapons: [],
            },
          ]
        : [],
    },
  },
  gameState: {},
});

jest.mock("../../../firebase/database", () => {
  return {
    __esModule: true,
    subscribeToGame: jest.fn((gameId, cb) => {
      // default with no target; tests can re-mock per case
      cb(makeGameDoc(false));
      return () => {};
    }),
    subscribeToGameUpdates: jest.fn((_gameId, _cb) => () => {}),
    updateGameState: jest.fn(() => Promise.resolve()),
  };
});

// Now import the page under test so mocks above are applied
const GameSession = require("pages/GameSession").default;

const user = { uid: "user-1" };

async function clickCardByTextAsync(txt) {
  const name = txt instanceof RegExp ? txt : new RegExp(String(txt), "i");
  const card = await screen.findByRole("button", { name });
  fireEvent.click(card);
}

describe("Attack Helper panel", () => {
  test("opens from weapon row click and shows placeholders when no target", async () => {
    // Initial mock: no target
    const _dbMod1 = require("../../../firebase/database");
    const db = _dbMod1 && _dbMod1.default ? _dbMod1.default : _dbMod1;
    db.subscribeToGame.mockImplementation((_id, cb) => {
      cb(makeGameDoc(false));
      return () => {};
    });

    render(<GameSession gameId="game-panel-1" user={user} />);

    await clickCardByTextAsync(/Test Squad/i);

    const row = await screen.findByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row);

    // Attack Helper visible
    expect(
      await screen.findByRole("region", { name: /attack helper/i }),
    ).toBeInTheDocument();

    // Shows dice notation instruction
    expect(await screen.findByText(/Roll\s*D6\+1/i)).toBeInTheDocument();
    // No target yet => messages prompt to select target
    expect(screen.getAllByText(/select a target/i).length).toBeGreaterThan(0);
  });

  test("with a target, shows to-hit, to-wound, and defender save details", async () => {
    const db = require("../../../firebase/database");
    db.subscribeToGame.mockImplementation((_id, cb) => {
      cb(makeGameDoc(true));
      return () => {};
    });

    render(<GameSession gameId="game-panel-2" user={user} />);

    // Select attacker and open helper
    await clickCardByTextAsync(/Test Squad/i);
    const row = await screen.findByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row);
    // With target selected later, panel remains visible and shows details
    // Click enemy to set target
    await clickCardByTextAsync(/Enemy/i);

    // Hit shows target only; probability now in tooltip
    const panel = await screen.findByRole("region", { name: /attack helper/i });
    expect(within(panel).getByText(/\bHit\b/i)).toBeInTheDocument();
    expect(within(panel).getByText(/3\+/i)).toBeInTheDocument();

    // Wound: S 4 vs T 5 => 5+
    expect(within(panel).getByText(/\bWound\b/i)).toBeInTheDocument();
    expect(within(panel).getByText(/5\+/i)).toBeInTheDocument();
    // probability now hover-only; verify via tooltip on Defender Save instead

    // Save breakdown now hover-only: hover the number and assert tooltip appears
    const defNum = within(panel).getByText(/4\+/i);
    fireEvent.mouseEnter(defNum);
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent(/Armour after AP/i);
  });

  test("changing models in range updates expected hits", async () => {
    const db = require("../../../firebase/database");
    db.subscribeToGame.mockImplementation((_id, cb) => {
      cb(makeGameDoc(false));
      return () => {};
    });

    render(<GameSession gameId="game-panel-3" user={user} />);

    await clickCardByTextAsync(/Test Squad/i);
    const row = await screen.findByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row);

    // Enable expected results
    const toggle = await screen.findByLabelText(/show expected results/i);
    fireEvent.click(toggle);

    const input = await screen.findByLabelText(/models in range/i);
    fireEvent.change(input, { target: { value: "2" } });

    // With BS 3+ (66.7%), D6+1 avg 4.5 per model -> 2 models => 9 attacks => 6.0 expected hits
    expect(
      await screen.findByText(/Expected hits:\s*6\.0/i),
    ).toBeInTheDocument();
  });
});
