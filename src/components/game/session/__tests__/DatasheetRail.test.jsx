import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DatasheetRail from "components/game/session/DatasheetRail";

const selectedUnit = { id: "u1", name: "Assault Intercessors", weapons: [] };

describe("DatasheetRail", () => {
  test("renders AttackHelperPanel when a unit is selected", () => {
    render(
      <DatasheetRail
        selectedUnit={selectedUnit}
        attackHelper={{ open: true, section: null, index: null }}
        allUnitsById={{ u1: selectedUnit }}
        defaultTargetUnit={null}
        onChangeModelsInRange={() => {}}
        onToggleExpected={() => {}}
      />,
    );

    expect(
      screen.getByRole("region", { name: /Attack Helper/i }),
    ).toBeInTheDocument();
  });
});
