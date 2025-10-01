import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import DatasheetCompare from "components/datasheet/DatasheetCompare";

const leftUnit = {
  id: "left1",
  name: "Left Unit",
  models: 5,
  wounds: 1,
  toughness: 4,
  armor_save: 3,
  keywords: [],
  modelGroups: [{ name: "Model", count: 5 }],
  weapons: [
    {
      name: "Bolt rifle",
      range: '24"',
      type: "Rapid Fire 1",
      attacks: 1,
      skill: 3,
      strength: 4,
      ap: 0,
      damage: 1,
    },
    {
      name: "Bolt rifle",
      range: '24"',
      type: "Rapid Fire 1",
      attacks: 1,
      skill: 3,
      strength: 4,
      ap: 0,
      damage: 1,
    },
    {
      name: "Chainsword",
      range: "Melee",
      type: "Melee",
      attacks: 3,
      skill: 3,
      strength: 4,
      ap: 0,
      damage: 1,
    },
  ],
};

const rightUnit = {
  id: "right1",
  name: "Right Unit",
  models: 5,
  wounds: 1,
  toughness: 4,
  armor_save: 3,
  keywords: [],
  modelGroups: [{ name: "Model", count: 5 }],
  weapons: [
    {
      name: "Plasma pistol",
      range: '12"',
      type: "Pistol 1",
      attacks: 1,
      skill: 3,
      strength: 7,
      ap: 2,
      damage: 1,
    },
    {
      name: "Power sword",
      range: "Melee",
      type: "Melee",
      attacks: 3,
      skill: 3,
      strength: 4,
      ap: 2,
      damage: 1,
    },
  ],
};

const leadershipOverrides = {};
const allUnits = [leftUnit, rightUnit];

describe("DatasheetCompare", () => {
  test("renders both datasheets with unit names", () => {
    render(
      <DatasheetCompare
        leftUnit={leftUnit}
        rightUnit={rightUnit}
        selectedUnit={leftUnit}
        hasArmyA={true}
        hasArmyB={true}
        leadershipOverrides={leadershipOverrides}
        allUnits={allUnits}
        updateUnitOverrides={() => {}}
        attackHelper={{ open: false }}
        onToggleWeaponLeft={() => {}}
        onToggleWeaponRight={() => {}}
        onCloseAttackHelper={() => {}}
        onChangeModelsInRange={() => {}}
        onToggleExpected={() => {}}
        targetUnit={rightUnit}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Left Unit/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Right Unit/i }),
    ).toBeInTheDocument();
  });

  test("clicking a left weapon calls onToggleWeaponLeft", () => {
    const onLeft = jest.fn();
    render(
      <DatasheetCompare
        leftUnit={leftUnit}
        rightUnit={rightUnit}
        selectedUnit={leftUnit}
        hasArmyA={true}
        hasArmyB={true}
        leadershipOverrides={leadershipOverrides}
        allUnits={allUnits}
        updateUnitOverrides={() => {}}
        attackHelper={{ open: false }}
        onToggleWeaponLeft={onLeft}
        onToggleWeaponRight={() => {}}
        onCloseAttackHelper={() => {}}
        onChangeModelsInRange={() => {}}
        onToggleExpected={() => {}}
        targetUnit={rightUnit}
      />,
    );

    // Click the weapon row (role=button) by accessible name; unique to left side in this fixture
    fireEvent.click(screen.getByRole("button", { name: /Bolt rifle/i }));
    expect(onLeft).toHaveBeenCalled();
  });
});
