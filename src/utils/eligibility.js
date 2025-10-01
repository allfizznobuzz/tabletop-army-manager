// Eligibility & overrides helpers
// Precedence: Pairwise Allow > Flags (canLead/canBeLed) > Auto (source data)

export const hasActiveOverrides = (ov) => {
  if (!ov) return false;
  const lead = !!(ov.canLead && ov.canLead !== "auto");
  const led = !!(ov.canBeLed && ov.canBeLed !== "auto");
  const allow = Array.isArray(ov.allowList) && ov.allowList.length > 0;
  return lead || led || allow;
};

export const countActiveOverrides = (ov) => {
  if (!ov) return 0;
  let n = 0;
  if (ov.canLead && ov.canLead !== "auto") n += 1;
  if (ov.canBeLed && ov.canBeLed !== "auto") n += 1;
  n += ov.allowList?.length || 0;
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
  const hasLeaderAbility = abilities.some((a) =>
    String(a.name || "")
      .toLowerCase()
      .includes("leader"),
  );
  if (!hasLeaderAbility) return false;

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
    const text = normalize(ability.description || ability.text);
    if (
      !(
        name.includes("leader") ||
        text.includes("this model can be attached to") ||
        text.includes("can be attached to")
      )
    ) {
      return false;
    }
    return text.includes(unitFull) || text.includes(unitBase);
  });
};
