import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GameSession from "../GameSession";

// Mock dnd-kit to avoid ESM issues
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

// Mock firebase
jest.mock("../../firebase/database", () => {
  return {
    subscribeToGame: jest.fn((gameId, cb) => {
      cb({
        id: gameId,
        name: "Carrier Resolver Test",
        currentTurn: "user-1",
        playerA: {
          displayName: "Player A",
          armyData: {
            units: [
              {
                name: "Test Squad",
                models: 5,
                wounds: 1,
                ballistic_skill: 3,
                weapon_skill: 4,
                weapons: [
                  {
                    name: "Power Fist",
                    range: "Melee",
                    type: "Melee",
                    attacks: 1,
                    strength: 8,
                    ap: -2,
                    damage: 2,
                    sergeantOnly: true,
                  },
                  {
                    name: "2x Astartes Chainsword",
                    range: "Melee",
                    type: "Melee",
                    attacks: 3,
                    strength: 4,
                    ap: 0,
                    damage: 1,
                  },
                ],
              },
              { name: "Other Squad", models: 5, wounds: 1, weapons: [] },
            ],
          },
        },
        playerB: { displayName: "Player B", armyData: { units: [] } },
        gameState: {},
      });
      return () => {};
    }),
    subscribeToGameUpdates: jest.fn((_gameId, _cb) => () => {}),
    updateGameState: jest.fn(() => Promise.resolve()),
  };
});

const user = { uid: "user-1" };

function clickCardByText(txt) {
  const name = txt instanceof RegExp ? txt : new RegExp(String(txt), "i");
  const card = screen.getByRole("button", { name });
  fireEvent.click(card);
}

describe("Weapon carrier defaults", () => {
  test("Power Fist defaults to 1; Chainsword defaults to 2 via 2x prefix", () => {
    render(<GameSession gameId="game-carriers" user={user} />);

    clickCardByText(/Test Squad/i);

    const fistRow = screen.getByRole("button", { name: /power fist/i });
    fireEvent.click(fistRow);
    const input1 = screen.getByLabelText(/models in range/i);
    expect(input1).toHaveValue(1);

    // Close and open Chainsword
    fireEvent.click(fistRow); // close
    const chainRow = screen.getByRole("button", { name: /chainsword/i });
    fireEvent.click(chainRow);
    const input2 = screen.getByLabelText(/models in range/i);
    expect(input2).toHaveValue(2);
  });
});
