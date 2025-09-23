import { parseArmyFile } from "../../utils/armyParser";

// Use require to load JSON reliably in Jest
const sampleSM = require("../../samples/sample-space-marines.json");

describe("Sample army JSON schema", () => {
  test("Space Marines sample conforms to internal schema", () => {
    const parsed = parseArmyFile(sampleSM);
    expect(parsed).toBeTruthy();
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.units)).toBe(true);
    expect(parsed.units.length).toBeGreaterThan(0);

    for (const unit of parsed.units) {
      expect(typeof unit.name).toBe("string");
      expect(typeof unit.models).toBe("number");
      expect(typeof unit.wounds).toBe("number");
      expect(Array.isArray(unit.weapons)).toBe(true);
      expect(Array.isArray(unit.abilities)).toBe(true);
      expect(Array.isArray(unit.rules)).toBe(true);
      expect(Array.isArray(unit.keywords)).toBe(true);
      for (const w of unit.weapons) {
        expect(typeof w.name).toBe("string");
        expect(typeof w.range).toBe("string");
        expect(typeof w.type).toBe("string");
        expect(typeof w.attacks).toBe("number");
        expect(typeof w.skill).toBe("number");
        expect(typeof w.strength).toBe("number");
        expect(typeof w.ap).toBe("number");
        expect(typeof w.damage).toBe("number");
      }
    }
  });
});
