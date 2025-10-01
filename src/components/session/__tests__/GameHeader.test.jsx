import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import GameHeader from "components/session/GameHeader";

describe("GameHeader", () => {
  test("renders name, round, turn, game id and shows overlay button when narrow with selection", () => {
    const onOpen = jest.fn();
    render(
      <GameHeader
        name="Test Game"
        round={2}
        isMyTurn={true}
        gameId="abc123"
        isNarrow={true}
        hasSelectedUnit={true}
        onOpenOverlay={onOpen}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Test Game/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Round: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Turn/i)).toBeInTheDocument();
    expect(screen.getByText(/Game ID: abc123/i)).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: /Open Datasheet/i });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("hides overlay button when not narrow or no selection", () => {
    render(
      <GameHeader
        name="Test Game"
        round={1}
        isMyTurn={false}
        gameId="g1"
        isNarrow={false}
        hasSelectedUnit={true}
        onOpenOverlay={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Open Datasheet/i }),
    ).not.toBeInTheDocument();

    render(
      <GameHeader
        name="Test Game"
        round={1}
        isMyTurn={false}
        gameId="g1"
        isNarrow={true}
        hasSelectedUnit={false}
        onOpenOverlay={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Open Datasheet/i }),
    ).not.toBeInTheDocument();
  });
});
