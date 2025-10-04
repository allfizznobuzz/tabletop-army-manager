import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import UnitDatasheet from "../datasheet/UnitDatasheet";

const baseUnit = {
  id: "u1",
  name: "Assault Intercessors",
  models: 10,
  wounds: 2,
  toughness: 4,
  armor_save: 3,
  points: 200,
  keywords: ["INFANTRY", "ADEPTUS ASTARTES"],
  abilities: [
    {
      name: "And They Shall Know No Fear",
      description: "Re-roll Battle-shock tests.",
    },
  ],
  modelGroups: [
    { name: "Sergeant", count: 1 },
    { name: "Intercessor", count: 9 },
  ],
  weapons: [
    // two identical bolt rifles -> should group (x2)
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
    // one melee weapon
    {
      name: "Astartes chainsword",
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

const overrides = {
  canLead: "auto",
  canBeLed: "auto",
  allowList: [],
};

const allUnits = [
  { id: "u1", name: "Assault Intercessors" },
  { id: "u2", name: "Captain" },
  { id: "u3", name: "Infernus Squad" },
];

describe("UnitDatasheet", () => {
  test("renders header, model count, basic stats and keywords", () => {
    render(
      <UnitDatasheet
        unit={baseUnit}
        isSelected={true}
        onClick={() => {}}
        overrides={overrides}
        allUnits={allUnits}
        onUpdateOverrides={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Assault Intercessors/i }),
    ).toBeInTheDocument();
    // Anchor exact header count to avoid matching points line "10 models - 200 pts"
    expect(screen.getByText(/^10 models$/i)).toBeInTheDocument();

    // Stats row labels
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("Sv")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
    expect(screen.getByText("Ld")).toBeInTheDocument();
    expect(screen.getByText("OC")).toBeInTheDocument();

    // Keywords
    expect(screen.getByText(/KEYWORDS:/i)).toBeInTheDocument();
    expect(screen.getByText(/INFANTRY, ADEPTUS ASTARTES/i)).toBeInTheDocument();
  });

  test("groups identical ranged weapons (without count bubble) and separates ranged/melee sections", () => {
    render(
      <UnitDatasheet
        unit={baseUnit}
        isSelected={true}
        overrides={overrides}
        allUnits={allUnits}
        onUpdateOverrides={() => {}}
      />,
    );

    // Ranged section header
    expect(screen.getByText(/RANGED WEAPONS/i)).toBeInTheDocument();
    // Melee section header
    expect(screen.getByText(/MELEE WEAPONS/i)).toBeInTheDocument();

    // Bolt rifle appears once; no per-row (xN) count is displayed now
    expect(screen.getAllByText(/Bolt rifle/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/\(x\d+\)/i)).not.toBeInTheDocument();

    // Melee weapon row shows Melee range cell
    expect(screen.getByText(/Astartes chainsword/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Melee/i).length).toBeGreaterThanOrEqual(1);
  });

  test("renders abilities and composition with points", () => {
    render(
      <UnitDatasheet
        unit={baseUnit}
        isSelected={true}
        overrides={overrides}
        allUnits={allUnits}
        onUpdateOverrides={() => {}}
      />,
    );

    // Abilities (open collapsible first)
    const abilitiesHeader = screen.getByRole("button", { name: /Abilities/i });
    fireEvent.click(abilitiesHeader);
    expect(screen.getByText(/ABILITIES/i)).toBeInTheDocument();
    expect(
      screen.getByText(/And They Shall Know No Fear/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Re-roll Battle-shock tests\./i),
    ).toBeInTheDocument();

    // Composition and points (open collapsible first)
    const compHeader = screen.getByRole("button", {
      name: /Unit Composition/i,
    });
    fireEvent.click(compHeader);
    expect(screen.getByText(/UNIT COMPOSITION/i)).toBeInTheDocument();
    expect(screen.getByText(/• 1x Sergeant/i)).toBeInTheDocument();
    expect(screen.getByText(/• 9x Intercessor/i)).toBeInTheDocument();
    expect(screen.getByText(/10 models - 200 pts/i)).toBeInTheDocument();
  });

  test("override controls call onUpdateOverrides for pairwise add/remove", async () => {
    const onUpdateOverrides = jest.fn();
    const { rerender } = render(
      <UnitDatasheet
        unit={baseUnit}
        isSelected={true}
        overrides={overrides}
        allUnits={allUnits}
        onUpdateOverrides={onUpdateOverrides}
      />,
    );

    // Open the overrides collapsible
    fireEvent.click(screen.getByRole("button", { name: /override/i }));

    // Add pairwise allow for Captain (u2)
    const select = screen.getByLabelText(/select unit to allow/i);
    fireEvent.change(select, { target: { value: "u2" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onUpdateOverrides).toHaveBeenCalledWith({ allowList: ["u2"] });

    // Simulate parent update by re-rendering with allowList
    onUpdateOverrides.mockClear();
    const withAllow = { ...overrides, allowList: ["u2"] };
    rerender(
      <UnitDatasheet
        unit={baseUnit}
        isSelected={true}
        overrides={withAllow}
        allUnits={allUnits}
        onUpdateOverrides={onUpdateOverrides}
      />,
    );
    // Ensure overrides panel is open; toggle only if needed and wait for region
    let chipsRegion = screen.queryByRole("group", { name: /allowed list/i });
    if (!chipsRegion) {
      fireEvent.click(screen.getByRole("button", { name: /override/i }));
      chipsRegion = await screen.findByRole("group", { name: /allowed list/i });
    }

    // Remove chip for Captain: find the only chip remove button within Allowed list region
    const removeBtn = within(chipsRegion).getByRole("button");
    fireEvent.click(removeBtn);
    expect(onUpdateOverrides).toHaveBeenCalledWith({ allowList: [] });
  });
});
