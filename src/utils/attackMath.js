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

// Detailed breakdown of defender saves after AP. Returns which save is used.
// Prefers invulnerable when equal to modified armour.
export function computeDefenderSave(armourSave, ap, invulnSave) {
  const armourAfterAp = applyApToSave(armourSave, ap);
  const inv = invulnSave
    ? Number(String(invulnSave).replace(/[^0-9]/g, ""))
    : null;
  let best = null;
  let used = null; // 'armour' | 'invuln'
  if (inv != null && (armourAfterAp == null || inv <= armourAfterAp)) {
    best = inv;
    used = "invuln";
  } else if (armourAfterAp != null) {
    best = armourAfterAp;
    used = "armour";
  }
  return { armourAfterAp, invuln: inv, best, used };
}

// Parse AP as integer, tolerant to unicode minus and strings like "-2" or "−2"
export function parseAp(ap) {
  if (ap === undefined || ap === null) return 0;
  const str = String(ap).replace(/−/g, "-").trim();
  const m = str.match(/-?\d+/);
  if (!m) return 0;
  return Number(m[0]) || 0;
}

// Explain the S vs T wound rule threshold
// Returns a phrase like "S ≥ 2T → 2+" or "S = T → 4+"
export function explainWoundRule(S, T) {
  const s = Number(S || 0);
  const t = Number(T || 0);
  if (!s || !t) return null;
  if (s >= 2 * t) return "S ≥ 2T → 2+";
  if (s > t) return "S > T → 3+";
  if (s === t) return "S = T → 4+";
  if (s * 2 <= t) return "S ≤ T/2 → 6+";
  return "S < T → 5+";
}

// Parse common dice notations like D3, D6, 2D6, D6+1, 2D3+3
// Returns { kind: 'fixed'|'dice', value: number|string, avg?: number, min?: number, max?: number }
export function parseDiceNotation(value) {
  if (value === undefined || value === null) return { kind: "fixed", value: 0 };
  if (typeof value === "number") return { kind: "fixed", value };
  const str = String(value).trim().toUpperCase();
  // Fixed integer inside string
  if (/^\d+$/.test(str)) return { kind: "fixed", value: Number(str) };

  // Pattern: XdY(+Z)? e.g., 2D6, D3, 2D3+1
  const m = str.match(/^(\d*)D(\d+)(?:\+(\d+))?$/);
  if (!m) return { kind: "dice", value: str };
  const diceCount = m[1] ? Number(m[1]) : 1;
  const dieSides = Number(m[2]);
  const bonus = m[3] ? Number(m[3]) : 0;
  if (!diceCount || !dieSides) return { kind: "dice", value: str };
  const avgSingle = (dieSides + 1) / 2;
  const avg = diceCount * avgSingle + bonus;
  const min = diceCount * 1 + bonus;
  const max = diceCount * dieSides + bonus;
  return { kind: "dice", value: str, avg, min, max };
}

// Parse Rapid Fire X from a weapon type string; returns integer X or 0 when absent
export function parseRapidFire(type) {
  if (!type) return 0;
  const m = String(type).match(/Rapid\s*Fire\s*(\d+)/i);
  return m ? Number(m[1]) || 0 : 0;
}

// Parse Sustained Hits X from a weapon type/keyword string; returns integer X or 0
export function parseSustainedHits(typeOrKeywords) {
  if (!typeOrKeywords) return 0;
  const str = Array.isArray(typeOrKeywords)
    ? typeOrKeywords.join(" ")
    : String(typeOrKeywords);
  const m = str.match(/Sustained\s*Hits\s*(\d+)/i);
  return m ? Number(m[1]) || 0 : 0;
}
