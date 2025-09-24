// Resolve how many models in the unit actually carry the given weapon.
// Precedence:
// 1) Explicit mapping on unit.weaponCarriers[weapon.name]
// 2) Explicit carryCount on weapon (or count when used to indicate carriers)
// 3) leader/sergeant-only flags -> 1
// 4) Parse prefix like "2x ..." on weapon.name or weapon.displayName
// 5) Fallback to unit's current model count
// Always cap to current model count (>=1)

export function resolveWeaponCarrierCount(unit, weapon) {
  if (!unit || !weapon) return 1;

  const currentModels =
    Number(unit.currentModels != null ? unit.currentModels : unit.models) || 1;

  // 1) explicit unit map by weapon display name
  const viaMap = unit.weaponCarriers && unit.weaponCarriers[weapon.name];
  if (Number.isFinite(viaMap)) {
    return boundCount(viaMap, currentModels);
  }

  // 2) explicit carryCount or count property on weapon
  const viaProp = weapon.carryCount ?? weapon.carrierCount ?? weapon.count;
  if (Number.isFinite(viaProp)) {
    return boundCount(viaProp, currentModels);
  }

  // 3) leader-only / sergeant-only markers
  if (
    weapon.sergeantOnly === true ||
    weapon.leaderOnly === true ||
    weapon.role === "sergeant" ||
    (Array.isArray(weapon.tags) && weapon.tags.includes("sergeant-only"))
  ) {
    return 1;
  }

  // 4) Parse prefix like "2x Chainsword" from name/displayName/optionLabel
  const txt = String(
    weapon.displayName || weapon.optionLabel || weapon.name || "",
  ).trim();
  const m = txt.match(/^(\d+)\s*x\s+/i);
  if (m) {
    return boundCount(Number(m[1]), currentModels);
  }

  // 5) fallback: all models
  return Math.max(1, currentModels);
}

function boundCount(n, maxModels) {
  const v = Math.max(1, Number(n) || 1);
  return Math.min(v, Math.max(1, Number(maxModels) || 1));
}

export default resolveWeaponCarrierCount;
