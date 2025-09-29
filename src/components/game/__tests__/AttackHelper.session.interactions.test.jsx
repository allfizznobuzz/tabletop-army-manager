import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
// NOTE: GameSession is required after jest.mock declarations below

// Mock @dnd-kit (ESM) to avoid transform issues in Jest
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

// Mock firebase database module used by GameSession
jest.mock("../../../firebase/database", () => {
  return {
    subscribeToGame: jest.fn((gameId, cb) => {
      // Minimal game doc with two armies and 2 units each
      cb({
        id: gameId,
        name: "Attack Helper Test Game",
        currentTurn: "user-1",
        playerA: {
          displayName: "Player A",
          armyData: {
            units: [
              {
                name: "A Grunts 1",
                models: 5,
                wounds: 1,
                ballistic_skill: 3,
                toughness: 4,
                armor_save: "3+",
                weapons: [
                  {
                    name: "Bolt rifle",
                    range: '24"',
                    type: "Rapid Fire 1",
                    attacks: 1,
                    strength: 4,
                    ap: -1,
                    damage: 1,
                  },
                ],
              },
              {
                name: "A Grunts 2",
                models: 5,
                wounds: 1,
                ballistic_skill: 3,
                toughness: 4,
                armor_save: "3+",
                weapons: [
                  {
                    name: "Bolt rifle",
                    range: '24"',
                    type: "Rapid Fire 1",
                    attacks: 1,
                    strength: 4,
                    ap: -1,
                    damage: 1,
                  },
                ],
              },
            ],
          },
        },
        playerB: {
          displayName: "Player B",
          armyData: {
            units: [
              {
                name: "B Target 1",
                models: 5,
                wounds: 1,
                toughness: 5,
                armor_save: "3+",
                invulnerable_save: "4+",
                weapons: [],
              },
              {
                name: "B Target 2",
                models: 5,
                wounds: 1,
                toughness: 4,
                armor_save: "2+",
                weapons: [],
              },
            ],
          },
        },
        gameState: {},
      });
      return () => {};
    }),
    subscribeToGameUpdates: jest.fn((_gameId, _cb) => {
      return () => {};
    }),
    updateGameState: jest.fn(() => Promise.resolve()),
  };
});

// Import after mocks
const GameSession = require("../GameSessionView").default;

const user = { uid: "user-1" };

async function clickCardByTextAsync(txt) {
  const name = txt instanceof RegExp ? txt : new RegExp(String(txt), "i");
  const btn = await screen.findByRole("button", { name });
  fireEvent.click(btn);
}

describe("GameSession Attack Helper interactions", () => {
  test("weapon→enemy opens, enemy→enemy recomputes, enemy→friendly collapses; click-away collapses (no console errors)", async () => {
    const spyErr = jest.spyOn(console, "error").mockImplementation(() => {});
    // Force initial game snapshot with both armies before rendering
    const db = require("../../../firebase/database");
    db.subscribeToGame.mockImplementation((gameId, cb) => {
      cb({
        id: gameId,
        name: "Attack Helper Test Game",
        currentTurn: "user-1",
        playerA: {
          displayName: "Player A",
          armyData: {
            units: [
              {
                name: "A Grunts 1",
                models: 5,
                wounds: 1,
                ballistic_skill: 3,
                toughness: 4,
                armor_save: "3+",
                weapons: [
                  {
                    name: "Bolt rifle",
                    range: '24"',
                    type: "Rapid Fire 1",
                    attacks: 1,
                    strength: 4,
                    ap: -1,
                    damage: 1,
                  },
                ],
              },
              {
                name: "A Grunts 2",
                models: 5,
                wounds: 1,
                ballistic_skill: 3,
                toughness: 4,
                armor_save: "3+",
                weapons: [
                  {
                    name: "Bolt rifle",
                    range: '24"',
                    type: "Rapid Fire 1",
                    attacks: 1,
                    strength: 4,
                    ap: -1,
                    damage: 1,
                  },
                ],
              },
            ],
          },
        },
        playerB: {
          displayName: "Player B",
          armyData: {
            units: [
              {
                name: "B Target 1",
                models: 5,
                wounds: 1,
                toughness: 5,
                armor_save: "3+",
                invulnerable_save: "4+",
                weapons: [],
              },
              {
                name: "B Target 2",
                models: 5,
                wounds: 1,
                toughness: 4,
                armor_save: "2+",
                weapons: [],
              },
            ],
          },
        },
        gameState: {},
      });
      return () => {};
    });

    render(<GameSession gameId="game-attack-helper" user={user} />);

    // Select friendly attacker (A Grunts 1)
    await clickCardByTextAsync(/A Grunts 1/i);

    // Open Attack Helper by clicking weapon row (Bolt rifle)
    const row = await screen.findByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row);

    // Panel opens with placeholders (no target yet)
    const panel = await screen.findByRole("region", { name: /attack helper/i });
    expect(panel).toBeInTheDocument();
    expect(
      within(panel).getAllByText(/select a target/i).length,
    ).toBeGreaterThanOrEqual(1);

    // Click enemy target 1 -> panel remains open and shows defender save details
    await clickCardByTextAsync(/B Target 1/i);
    expect(
      screen.getByRole("region", { name: /attack helper/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Defender Save/i)).toBeInTheDocument();
    // Best save is shown as e.g. "3+ (Inv)"
    expect(screen.getByText(/\(\s*Inv\s*\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Armour after AP/i)).toBeInTheDocument();

    // Click enemy target 2 (different save) -> recompute stays open
    await clickCardByTextAsync(/B Target 2/i);
    expect(
      screen.getByRole("region", { name: /attack helper/i }),
    ).toBeInTheDocument();
    // New best armour should reflect armour after AP breakdown
    expect(screen.getByText(/Armour after AP/i)).toBeInTheDocument();

    // Click friendly unit -> panel persists (sticky rail) but resets selection; datasheet switches
    await clickCardByTextAsync(/A Grunts 2/i);
    const panelAfterSwitch = await screen.findByRole("region", {
      name: /attack helper/i,
    });
    expect(panelAfterSwitch).toBeInTheDocument();
    // Shows placeholders prompting to select a weapon (scope within the panel)
    expect(within(panelAfterSwitch).getByText(/attacks/i)).toBeInTheDocument();
    expect(
      within(panelAfterSwitch).getAllByText(/select a weapon/i).length,
    ).toBeGreaterThan(0);
    // New datasheet header shows A Grunts 2 (scope to the datasheet area main -> h2)
    const datasheetMain = screen.getByRole("main");
    expect(
      within(datasheetMain).getByRole("heading", {
        level: 2,
        name: /A Grunts 2/i,
      }),
    ).toBeInTheDocument();

    // Re-open panel and target, then click empty space to collapse
    const row2 = await screen.findByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row2);
    await clickCardByTextAsync(/B Target 1/i);
    // Click-away on the grid container (outside-click listener uses pointerup)
    const grid = screen.getByTestId("game-content");
    fireEvent.pointerUp(grid);
    // First click-away happens in the same tick as weapon toggle; panel should remain (guarded)
    const panelAfterClickAway = await screen.findByRole("region", {
      name: /attack helper/i,
    });
    expect(
      within(panelAfterClickAway).getByText(/bolt rifle/i),
    ).toBeInTheDocument();
    // Second click-away should reset selection (no weapon)
    fireEvent.pointerUp(grid);
    await waitFor(() =>
      expect(
        within(panelAfterClickAway).getByText(/attacks/i),
      ).toBeInTheDocument(),
    );
    expect(
      within(panelAfterClickAway).getAllByText(/select a weapon/i).length,
    ).toBeGreaterThan(0);
    expect(spyErr).not.toHaveBeenCalled();
    spyErr.mockRestore();
  });
});
