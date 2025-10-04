import { parseArmyFile } from "../armyParser";
import WE from "samples/sample-army-WE.json";

describe("armyParser core stats normalization", () => {
  test("parses M/T/Sv/W/Ld/OC from a BattleScribe Unit profile", () => {
    const battleScribeArmy = {
      roster: {
        name: "WE Test",
        forces: [
          {
            name: "World Eaters",
            selections: [
              {
                id: "u1",
                name: "Test Lord",
                type: "unit",
                number: 1,
                profiles: [
                  {
                    name: "Test Lord",
                    typeName: "Unit",
                    characteristics: [
                      { name: "M", $text: '14"' },
                      { name: "T", $text: "11" },
                      { name: "Sv", $text: "2+" },
                      { name: "W", $text: "16" },
                      { name: "LD", $text: "5+" },
                      { name: "OC", $text: "6" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = parseArmyFile(battleScribeArmy);
    expect(result.units).toHaveLength(1);
    const unit = result.units[0];

    // movement as literal string
    expect(unit.move).toBe('14"');
    // numeric primary stats
    expect(unit.toughness).toBe(11);
    expect(unit.wounds).toBe(16);
    // Sv/Ld stored as numbers without '+'
    expect(unit.armor_save).toBe(2);
    expect(unit.leadership).toBe(5);
    // OC numeric
    expect(unit.oc).toBe(6);
  });

  test("parses Angron stats from sample-army-WE.json", () => {
    const result = parseArmyFile(WE);
    const angron = result.units.find((u) => /angron/i.test(u.name));
    expect(angron).toBeTruthy();

    // Expect the canonical values
    expect(angron.move).toBe('14"');
    expect(angron.toughness).toBe(11);
    expect(angron.armor_save).toBe(2);
    expect(angron.wounds).toBe(16);
    expect(angron.leadership).toBe(5);
    expect(angron.oc).toBe(6);
  });
});
