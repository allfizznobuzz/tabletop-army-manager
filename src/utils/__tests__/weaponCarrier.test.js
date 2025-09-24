import { resolveWeaponCarrierCount } from "../weaponCarrier";

describe("weaponCarrier.resolveWeaponCarrierCount", () => {
  const baseUnit = (over = {}) => ({ models: 5, ...over });
  const w = (over = {}) => ({ name: "Astartes Chainsword", ...over });

  it("uses explicit unit.weaponCarriers map and caps to current models", () => {
    const unit = baseUnit({
      weaponCarriers: { "Astartes Chainsword": 7 },
      currentModels: 4,
    });
    expect(resolveWeaponCarrierCount(unit, w())).toBe(4);
  });

  it("uses explicit carryCount on weapon", () => {
    const unit = baseUnit({ models: 10 });
    expect(resolveWeaponCarrierCount(unit, w({ carryCount: 3 }))).toBe(3);
  });

  it("uses leader/sergeant-only flag => 1", () => {
    const unit = baseUnit({ models: 10 });
    expect(resolveWeaponCarrierCount(unit, w({ sergeantOnly: true }))).toBe(1);
    expect(resolveWeaponCarrierCount(unit, w({ leaderOnly: true }))).toBe(1);
    expect(resolveWeaponCarrierCount(unit, w({ role: "sergeant" }))).toBe(1);
  });

  it('parses "2x ..." prefix from name/displayName', () => {
    const unit = baseUnit({ models: 10 });
    expect(
      resolveWeaponCarrierCount(unit, { name: "2x Astartes Chainsword" }),
    ).toBe(2);
    expect(
      resolveWeaponCarrierCount(unit, {
        name: "Astartes Chainsword",
        displayName: "3x Astartes Chainsword",
      }),
    ).toBe(3);
  });

  it("falls back to unit models", () => {
    const unit = baseUnit({ models: 6 });
    expect(resolveWeaponCarrierCount(unit, w({ name: "Bolt pistol" }))).toBe(6);
  });
});
