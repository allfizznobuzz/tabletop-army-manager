import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import GameSession from "../GameSession";

// Mock @dnd-kit (ESM) to avoid transform issues in Jest
jest.mock("@dnd-kit/core", () => ({
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
  restrictToVerticalAxis: jest.fn(),
  restrictToFirstScrollableAncestor: jest.fn(),
}));
jest.mock("@dnd-kit/sortable", () => ({
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
  CSS: { Transform: { toString: () => "" } },
}));

// Mock firebase database module used by GameSession
jest.mock("../../firebase/database", () => {
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
                invulnerable_save: "5+",
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

const user = { uid: "user-1" };

function clickCardByText(txt) {
  const title = screen.getByText(txt);
  // Click the closest unit card (role="button")
  const card = title.closest(".unit-card");
  if (!card) throw new Error("unit card not found for " + txt);
  fireEvent.click(card);
}

describe("GameSession Attack Helper interactions", () => {
  test("weapon→enemy opens, enemy→enemy recomputes, enemy→friendly collapses; click-away collapses (no console errors)", () => {
    const spyErr = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<GameSession gameId="game-attack-helper" user={user} />);

    // Select friendly attacker (A Grunts 1)
    clickCardByText(/A Grunts 1/i);

    // Open Attack Helper by clicking weapon row (Bolt rifle)
    const row = screen.getByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row);

    // Panel opens with placeholders (no target yet)
    const panel = screen.getByRole("region", { name: /attack helper/i });
    expect(panel).toBeInTheDocument();
    expect(within(panel).getAllByText(/missing/i).length).toBeGreaterThanOrEqual(1);

    // Click enemy target 1 -> panel remains open and shows defender save details
    clickCardByText(/B Target 1/i);
    expect(screen.getByRole("region", { name: /attack helper/i })).toBeInTheDocument();
    expect(screen.getByText(/Defender Save/i)).toBeInTheDocument();
    expect(screen.getByText(/Invuln:/i)).toBeInTheDocument();

    // Click enemy target 2 (different save) -> recompute stays open
    clickCardByText(/B Target 2/i);
    expect(screen.getByRole("region", { name: /attack helper/i })).toBeInTheDocument();
    // New best armour should show 2+
    expect(screen.getByText(/Armour.*2\+/i)).toBeInTheDocument();

    // Click friendly unit -> helper collapses and datasheet switches
    clickCardByText(/A Grunts 2/i);
    expect(screen.queryByRole("region", { name: /attack helper/i })).not.toBeInTheDocument();
    // New datasheet header shows A Grunts 2
    expect(screen.getByRole("heading", { name: /A Grunts 2/i })).toBeInTheDocument();

    // Re-open panel and target, then click empty space to collapse
    const row2 = screen.getByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row2);
    clickCardByText(/B Target 1/i);
    // Click-away on the grid container
    const grid = screen.getByTestId("game-content");
    fireEvent.pointerDown(grid);
    expect(screen.queryByRole("region", { name: /attack helper/i })).not.toBeInTheDocument();
    expect(spyErr).not.toHaveBeenCalled();
    spyErr.mockRestore();
  });
});
