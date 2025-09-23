// Attack Helper math utilities

// Map Strength vs Toughness to wound target (2..6) according to 10th ed rules
export function woundTarget(strength, toughness) {
  const S = Number(strength || 0);
  const T = Number(toughness || 0);
  if (!S || !T) return null; // missing
  if (S >= 2 * T) return 2;
  if (S > T) return 3;
  if (S === T) return 4;
  if (S * 2 <= T) return 6;
  return 5;
}

// Convert a target like 2..6 to probability (0..1)
export function probabilityFromTarget(target) {
  if (!target || target < 2) return null;
  const p = (7 - target) / 6;
  return Math.max(0, Math.min(1, p));
}

// Apply AP to armour save; lower targets are better (2..6). Returns null if no armour save.
export function applyApToSave(armourSave, ap) {
  if (!armourSave) return null;
  const svNum = Number(String(armourSave).replace(/[^0-9]/g, ""));
  if (!svNum) return null;
  const apVal = Number(ap || 0);
  const mod = Math.abs(apVal);
  return Math.min(6, Math.max(2, svNum + mod));
}

// Choose best save target between modified armour and invuln (lower is better)
export function bestSaveTargetAfterAp(armourSave, ap, invulnSave) {
  const arm = applyApToSave(armourSave, ap);
  const inv = invulnSave
    ? Number(String(invulnSave).replace(/[^0-9]/g, ""))
    : null;
  if (arm && inv) return Math.min(arm, inv);
  return arm || inv || null;
}

// Parse common dice notations like D3, D6, 2D6, D6+1, 2D3+3
// Returns { kind: 'fixed'|'dice', value: number|string, avg?: number, min?: number, max?: number }
export function parseDiceNotation(value) {
  if (value === undefined || value === null) return { kind: 'fixed', value: 0 };
  if (typeof value === 'number') return { kind: 'fixed', value };
  const str = String(value).trim().toUpperCase();
  // Fixed integer inside string
  if (/^\d+$/.test(str)) return { kind: 'fixed', value: Number(str) };

  // Pattern: XdY(+Z)? e.g., 2D6, D3, 2D3+1
  const m = str.match(/^(\d*)D(\d+)(?:\+(\d+))?$/);
  if (!m) return { kind: 'dice', value: str };
  const diceCount = m[1] ? Number(m[1]) : 1;
  const dieSides = Number(m[2]);
  const bonus = m[3] ? Number(m[3]) : 0;
  if (!diceCount || !dieSides) return { kind: 'dice', value: str };
  const avgSingle = (dieSides + 1) / 2;
  const avg = diceCount * avgSingle + bonus;
  const min = diceCount * 1 + bonus;
  const max = diceCount * dieSides + bonus;
  return { kind: 'dice', value: str, avg, min, max };
}
