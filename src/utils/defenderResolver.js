// Resolve defender stats from various field names and formats
// Returns { toughness: number|null, armourSave: number|null, invulnSave: number|null }
export function resolveDefenderStats(unit) {
  if (!unit) return { toughness: null, armourSave: null, invulnSave: null };

  const get = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      // Try case-insensitive lookup
      const foundKey = Object.keys(obj).find(
        (key) => key.toLowerCase() === String(k).toLowerCase(),
      );
      if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null)
        return obj[foundKey];
    }
    return undefined;
  };

  const parseSave = (val) => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    const m = str.match(/(\d)/);
    if (!m) return null;
    const num = Number(m[1]);
    if (!num || Number.isNaN(num)) return null;
    return Math.max(2, Math.min(6, num));
  };

  const toughnessKeys = ["toughness", "T", "Toughness"]; // numeric
  const svKeys = [
    "armor_save",
    "armour_save",
    "armourSave",
    "armorsave",
    "save",
    "SV",
    "Sv",
    "Armour Save",
    "Armour save",
  ];
  const invulnKeys = [
    "invulnerable_save",
    "invulnerable",
    "invuln_save",
    "invuln",
    "Invulnerable Save",
    "Invulnerable",
  ];

  const T = Number(get(unit, toughnessKeys));
  const SvRaw = get(unit, svKeys);
  let InvRaw = get(unit, invulnKeys);

  // Fallback: attempt to extract invulnerable save from abilities array if present
  if (
    (InvRaw === undefined || InvRaw === null) &&
    Array.isArray(unit.abilities)
  ) {
    for (const ab of unit.abilities) {
      try {
        const name = String(ab?.name || "").toLowerCase();
        const desc = String(ab?.description || "").toLowerCase();
        if (
          /invulnerable/.test(name) ||
          /invulnerable/.test(desc) ||
          /daemon(ic)?\s*save/.test(desc)
        ) {
          const m = String(ab?.description || "").match(/(\d)\s*\+/);
          if (m) {
            InvRaw = m[1];
            break;
          }
        }
      } catch (_) {
        // ignore ability parse errors
      }
    }
  }

  const toughness = T && !Number.isNaN(T) ? T : null;
  const armourSave = parseSave(SvRaw);
  const invulnSave = parseSave(InvRaw);

  return { toughness, armourSave, invulnSave };
}
