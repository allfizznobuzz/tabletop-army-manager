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
