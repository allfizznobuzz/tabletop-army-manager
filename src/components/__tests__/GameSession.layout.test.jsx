import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import GameSession from "../GameSession";
import { updateGameState } from "../../firebase/database";
import { parseArmyFile } from "../../utils/armyParser";

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
      // minimal game doc with no armies
      cb({
        id: gameId,
        name: "Test Game",
        currentTurn: "user-1",
        playerA: { displayName: "Player A" },
        playerB: { displayName: "Player B" },
        gameState: {},
      });
      return () => {};
    }),
    subscribeToGameUpdates: jest.fn((_gameId, _cb) => {
      return () => {};
    }),
    updateGameState: jest.fn(() => Promise.resolve()),
    assignDamage: jest.fn(() => Promise.resolve()),
  };
});

// Mock parseArmyFile to return a normalized army structure
jest.mock("../../utils/armyParser", () => {
  return {
    parseArmyFile: jest.fn((json) => json),
  };
});

const user = { uid: "user-1" };

describe("GameSession three-column layout and upload", () => {
  test("renders A | Datasheet | B columns with dropzones when empty", async () => {
    render(<GameSession gameId="game-123" user={user} />);

    // Column headers
    expect(screen.getByText(/Player A/i)).toBeInTheDocument();
    expect(screen.getByText(/Player B/i)).toBeInTheDocument();

    // Dropzones present for both when no armies
    const dzA = screen.getByRole("button", {
      name: /upload army file dropzone for player a/i,
    });
    const dzB = screen.getByRole("button", {
      name: /upload army file dropzone for player b/i,
    });
    expect(dzA).toBeInTheDocument();
    expect(dzB).toBeInTheDocument();

    // Center panel hints
    expect(
      screen.getByText(/start by adding armies to both columns/i),
    ).toBeInTheDocument();
  });

  test("importing a JSON file updates game state for Player A", async () => {
    render(<GameSession gameId="game-456" user={user} />);

    const inputA = screen.getByLabelText(/upload army file for player a/i);

    // Create a mock File with a text() that returns JSON
    const file = new File(
      [
        JSON.stringify({
          name: "Test Army",
          units: [{ name: "Unit 1", wounds: 1 }],
        }),
      ],
      "army.json",
      {
        type: "application/json",
      },
    );
    // Some JSDOMs lack File.text(), patch it
    file.text =
      file.text ||
      (async () =>
        JSON.stringify({
          name: "Test Army",
          units: [{ name: "Unit 1", wounds: 1 }],
        }));

    // Ensure parser returns the same structure
    parseArmyFile.mockImplementation((json) => json);

    // Fire change event
    fireEvent.change(inputA, { target: { files: [file] } });

    await waitFor(() => {
      expect(updateGameState).toHaveBeenCalled();
    });

    const lastCall = updateGameState.mock.calls.pop();
    expect(lastCall[0]).toBe("game-456");
    const payload = lastCall[1];
    expect(payload["playerA.armyData"]).toBeTruthy();
    expect(payload["gameState.columns.A.attachments"]).toBeDefined();
    expect(payload["gameState.columns.A.unitOrder"]).toBeInstanceOf(Array);
  });

  test("importing a JSON file updates game state for Player B", async () => {
    render(<GameSession gameId="game-789" user={user} />);

    const inputB = screen.getByLabelText(/upload army file for player b/i);

    const file = new File(
      [
        JSON.stringify({
          name: "Test Army B",
          units: [{ name: "B Unit", wounds: 2 }],
        }),
      ],
      "armyB.json",
      { type: "application/json" },
    );
    file.text =
      file.text ||
      (async () =>
        JSON.stringify({
          name: "Test Army B",
          units: [{ name: "B Unit", wounds: 2 }],
        }));

    parseArmyFile.mockImplementation((json) => json);

    fireEvent.change(inputB, { target: { files: [file] } });

    await waitFor(() => {
      expect(updateGameState).toHaveBeenCalled();
    });

    const lastCall = updateGameState.mock.calls.pop();
    expect(lastCall[0]).toBe("game-789");
    const payload = lastCall[1];
    expect(payload["playerB.armyData"]).toBeTruthy();
    expect(payload["gameState.columns.B.attachments"]).toBeDefined();
    expect(payload["gameState.columns.B.unitOrder"]).toBeInstanceOf(Array);
  });

  test("shows error message on invalid file type and JSON parse error", async () => {
    render(<GameSession gameId="game-err" user={user} />);
    const inputA = screen.getByLabelText(/upload army file for player a/i);

    // Invalid extension
    const badFile = new File(["oops"], "bad.txt", { type: "text/plain" });
    badFile.text = badFile.text || (async () => "oops");

    fireEvent.change(inputA, { target: { files: [badFile] } });

    // Dropzone should display validation error
    expect(
      await screen.findByText(/unsupported file type/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/bad\.txt/i)).toBeInTheDocument();

    // JSON parse error
    const brokenJson = new File(["not-json"], "army.json", {
      type: "application/json",
    });
    brokenJson.text = brokenJson.text || (async () => "not-json");
    fireEvent.change(inputA, { target: { files: [brokenJson] } });

    expect(await screen.findByText(/failed to import/i)).toBeInTheDocument();
    expect(screen.getByText(/army\.json/i)).toBeInTheDocument();
  });
});
