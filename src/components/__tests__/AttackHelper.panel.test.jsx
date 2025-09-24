import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import UnitDatasheet from "../UnitDatasheet";

const baseUnit = {
  id: "u1",
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
  abilities: [],
  modelGroups: [],
};

const overrides = { canLead: "auto", canBeLed: "auto", allowList: [] };

function Harness({ withTarget = false }) {
  const [attackHelper, setAttackHelper] = useState({
    open: true,
    section: "ranged",
    index: 0,
    modelsInRange: 3,
    targetUnitId: null,
  });
  const target = withTarget
    ? {
        id: "enemy1",
        name: "Enemy",
        toughness: 5,
        armor_save: "3+",
        invulnerable_save: "5+",
      }
    : null;

  return (
    <UnitDatasheet
      unit={baseUnit}
      isSelected
      overrides={overrides}
      allUnits={[baseUnit]}
      onUpdateOverrides={() => {}}
      attackHelper={attackHelper}
      onToggleWeapon={(section, index) =>
        setAttackHelper((p) => ({
          ...p,
          open: !(p.open && p.section === section && p.index === index),
          section,
          index,
        }))
      }
      onCloseAttackHelper={() =>
        setAttackHelper({
          open: false,
          section: null,
          index: null,
          modelsInRange: null,
          targetUnitId: null,
        })
      }
      onChangeModelsInRange={(val) =>
        setAttackHelper((p) => ({ ...p, modelsInRange: Number(val) || 1 }))
      }
      selectedTargetUnit={target}
    />
  );
}

describe("Attack Helper panel", () => {
  test("opens from weapon row click and shows placeholders when no target", () => {
    render(<Harness withTarget={false} />);

    // Weapon row toggles
    const row = screen.getByRole("button", { name: /bolt rifle/i });
    fireEvent.click(row); // close
    fireEvent.click(row); // open again

    // Attack Helper visible
    expect(
      screen.getByRole("region", { name: /attack helper/i }),
    ).toBeInTheDocument();

    // Shows dice notation instruction and models-based averages
    expect(
      screen.getByText(/roll d6\+1 to determine attacks/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Avg: 13.5/i)).toBeInTheDocument(); // (D6+1 avg 4.5) * 3 models

    // To Wound and Defender Save show missing chips without a target
    expect(screen.getAllByText(/missing/i).length).toBeGreaterThanOrEqual(2);
  });

  test("with a target, shows to-hit, to-wound, and defender save details", () => {
    render(<Harness withTarget={true} />);

    // To Hit probability helper
    expect(screen.getByText(/3\+\s*\(p≈66\.7%\)/i)).toBeInTheDocument();

    // To Wound: S 4 vs T 5 => 5+
    expect(screen.getByText(/5\+\s*\(p≈33\.3%\)/i)).toBeInTheDocument();

    // Defender Save: Best save value plus breakdown line
    expect(screen.getByText(/Best save:\s*\d\+/i)).toBeInTheDocument();
    expect(screen.getByText(/Armour after AP/i)).toBeInTheDocument();

    // Damage footer
    expect(screen.getByText(/Each failed save: 2/i)).toBeInTheDocument();
  });

  test("changing models in range updates attacks display", () => {
    render(<Harness withTarget={false} />);

    const input = screen.getByLabelText(/models in range/i);
    fireEvent.change(input, { target: { value: "2" } });

    // Avg changes to (4.5 * 2) = 9.0
    expect(screen.getByText(/Avg: 9\.0/i)).toBeInTheDocument();
  });
});
