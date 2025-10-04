// Eligibility & overrides helpers
// Precedence: Pairwise Allow > Flags (canLead/canBeLed) > Auto (source data)

const abilityOverrideCount = (ov) => {
  try {
    const ab = ov?.abilities;
    if (!ab) return 0;
    let n = 0;
    // Count faction only when a custom string is provided
    if (typeof ab.faction === "string" && ab.faction.trim()) n += 1;
    // Count core entries only when not undefined and not explicitly false
    if (ab.core) {
      n += Object.keys(ab.core).filter(
        (k) => ab.core[k] !== undefined && ab.core[k] !== false,
      ).length;
    }
    // Named support deprecated; if present, count only those explicitly enabled
    if (ab.named) {
      n += Object.keys(ab.named).filter((k) => ab.named[k] === true).length;
    }
    return n;
  } catch (_) {
    return 0;
  }
};

export const hasActiveOverrides = (ov) => {
  if (!ov) return false;
  const lead = !!(ov.canLead && ov.canLead !== "auto");
  const led = !!(ov.canBeLed && ov.canBeLed !== "auto");
  const allow = Array.isArray(ov.allowList) && ov.allowList.length > 0;
  const abilities = abilityOverrideCount(ov) > 0;
  return lead || led || allow || abilities;
};

export const countActiveOverrides = (ov) => {
  if (!ov) return 0;
  let n = 0;
  if (ov.canLead && ov.canLead !== "auto") n += 1;
  if (ov.canBeLed && ov.canBeLed !== "auto") n += 1;
  n += ov.allowList?.length || 0;
  n += abilityOverrideCount(ov);
  return n;
};

export const getOverrideSummary = (ov, resolveName) => {
  if (!hasActiveOverrides(ov)) return "No overrides";
  const parts = [];
  if (ov.canLead && ov.canLead !== "auto")
    parts.push(`Lead ${ov.canLead === "yes" ? "✓" : "✗"}`);
  if (ov.canBeLed && ov.canBeLed !== "auto")
    parts.push(`Led ${ov.canBeLed === "yes" ? "✓" : "✗"}`);
  const names = (ov.allowList || []).map((id) =>
    resolveName ? resolveName(id) : id,
  );
  if (names.length) parts.push(`Allow: ${names.join(", ")}`);
  const abCount = abilityOverrideCount(ov);
  if (abCount > 0) parts.push(`Abilities ${abCount}`);
  return parts.join("; ");
};

// canAttach: decides if leader can attach to unit based on overrides map and source check.
// - leader: object with id
// - unit: object with id
// - overridesMap: { [unitId]: { canLead, canBeLed, allowList } }
// - sourceCheck: function(leader, unit) -> boolean
export const canAttach = (leader, unit, overridesMap, sourceCheck) => {
  if (!leader || !unit) return false;
  if (leader.id === unit.id) return false;
  const lOv = overridesMap?.[leader.id] || {
    canLead: "auto",
    canBeLed: "auto",
    allowList: [],
  };
  const uOv = overridesMap?.[unit.id] || {
    canLead: "auto",
    canBeLed: "auto",
    allowList: [],
  };

  // 1) Pairwise Allow
  if (
    (lOv.allowList || []).includes(unit.id) ||
    (uOv.allowList || []).includes(leader.id)
  )
    return true;

  // 2) Flags
  if (lOv.canLead === "no" || uOv.canBeLed === "no") return false;
  if (lOv.canLead === "yes" || uOv.canBeLed === "yes") return true;

  // 3) Auto via source
  return !!(sourceCheck && sourceCheck(leader, unit));
};

// Heuristic leader detection with override support.
// If overrides specify canLead explicitly, honor that. Otherwise infer from data.
export const isLeaderUnit = (unit, overridesMap) => {
  if (!unit) return false;
  const ov = overridesMap?.[unit.id];
  if (ov?.canLead === "yes") return true;
  if (ov?.canLead === "no") return false;

  const keywords = (unit.keywords || []).map((k) => String(k).toLowerCase());
  const rules = (unit.rules || []).map((r) => String(r).toLowerCase());
  const abilities = unit.abilities || [];
  const name = String(unit.name || "").toLowerCase();

  const hasLeaderKeyword = keywords.includes("leader");
  const hasCharacterKeyword = keywords.includes("character");
  const hasLeaderRule = rules.some((r) => r.includes("leader"));
  const hasLeaderAbility = abilities.some((a) =>
    String(a.name || "")
      .toLowerCase()
      .includes("leader"),
  );
  const hasAttachText = abilities.some((a) =>
    String(a.description || a.text || "")
      .toLowerCase()
      .includes("this model can be attached to"),
  );

  const commonLeaderNames = [
    "captain",
    "commander",
    "lieutenant",
    "librarian",
    "chaplain",
    "ancient",
    "champion",
    "sanguinary",
    "priest",
    "company master",
    "apothecary",
    "judiciar",
  ];
  const isCommonLeaderName = commonLeaderNames.some((n) => name.includes(n));

  return (
    hasLeaderKeyword ||
    hasCharacterKeyword ||
    hasLeaderRule ||
    hasLeaderAbility ||
    hasAttachText ||
    isCommonLeaderName
  );
};

// Strict source-data check: whether a leader can be attached to a specific unit
// by scanning the leader's abilities text for explicit permission.
export const sourceCanAttach = (leader, draggedUnit) => {
  if (!leader || !draggedUnit) return false;
  const abilities = leader.abilities || [];
  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const unitFull = normalize(draggedUnit.name);
  const unitBase = normalize(draggedUnit.name.replace(/\bwith\b.*$/, ""));

  return abilities.some((ability) => {
    const name = normalize(ability.name);
    const rawText = ability.description || ability.text || ability.$text || "";
    const text = normalize(rawText);
    if (!text) return false;
    // Accept any ability that clearly mentions attach/attached, or the name contains "leader"
    const mentionsAttach = text.includes("attach") || text.includes("attached");
    if (!(mentionsAttach || name.includes("leader"))) return false;
    return text.includes(unitFull) || text.includes(unitBase);
  });
};
