import React, { useMemo, useState } from "react";
import "./UnitDatasheet.css";

// Remove simple markdown-like markers and HTML tags from imported text
const sanitizeRichText = (value) => {
  if (value == null) return "";
  let s = String(value);
  // Strip HTML tags
  s = s.replace(/<\/?[^>]+(>|$)/g, "");
  // Handle paired markers first
  s = s.replace(/\*\*(.*?)\*\*/g, "$1"); // **bold**
  s = s.replace(/__(.*?)__/g, "$1"); // __underline__
  s = s.replace(/\^\^(.*?)\^\^/g, "$1"); // ^^superscript^^
  // Remove any leftover repeated markers
  s = s.replace(/\*\*/g, "");
  s = s.replace(/\^\^/g, "");
  return s;
};

// Ability Overrides UI: Core/Faction/Named compact controls
const AbilityOverrides = ({ overrides, onUpdateOverrides }) => {
  const ov = overrides?.abilities || {};
  const core = ov.core || {};

  const updateAbilities = (updater) => {
    const prev = overrides?.abilities || {};
    const nextPartial =
      typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
    // Important: if updater produced a full next core, use it as-is so deletions persist
    const nextCore = Object.prototype.hasOwnProperty.call(nextPartial, "core")
      ? nextPartial.core
      : prev.core;
    const nextNamed = Object.prototype.hasOwnProperty.call(nextPartial, "named")
      ? nextPartial.named
      : prev.named;
    onUpdateOverrides?.({
      abilities: {
        ...prev,
        ...nextPartial,
        core: nextCore,
        named: nextNamed,
      },
    });
  };

  const setCore = (key, value) => {
    updateAbilities((prev) => {
      const nextCore = { ...(prev.core || {}) };
      if (value === "auto" || value === undefined) delete nextCore[key];
      else nextCore[key] = value;
      return { ...prev, core: nextCore };
    });
  };
  // Named ability overrides removed per user request
  const setFaction = (mode, text) => {
    updateAbilities((prev) => {
      let v;
      if (mode === "hide") v = false;
      else if (mode === "custom") v = (text || "").trim();
      else v = undefined; // auto
      const next = { ...prev };
      if (v === undefined) delete next.faction;
      else next.faction = v;
      return next;
    });
  };

  const modeFromFaction = () => {
    if (ov.faction === false) return "hide";
    if (typeof ov.faction === "string") return "custom";
    return "auto";
  };

  const [factionMode, setFactionMode] = useState(modeFromFaction());
  const [factionText, setFactionText] = useState(
    typeof ov.faction === "string" ? ov.faction : "",
  );

  const toggleFactionCustom = (e) => {
    const checked = e.target.checked;
    if (checked) {
      setFactionMode("custom");
      setFaction("custom", factionText);
    } else if (factionMode === "custom") {
      setFactionMode("auto");
      setFaction("auto");
    }
  };
  const onFactionTextBlur = (e) => {
    const txt = e.target.value;
    setFactionText(txt);
    if (factionMode === "custom") setFaction("custom", txt);
  };

  // Core tri-state cycle: undefined (default) -> true (enabled) -> false (disabled) -> undefined
  const cycleCore = (key) => {
    const cur = core[key];
    if (cur === true) setCore(key, false);
    else if (cur === false) setCore(key, undefined);
    else setCore(key, true);
  };
  const isCoreChecked = (key) => core[key] === true;

  // Param helpers (single checkbox + number when active)
  const isParamChecked = (key) =>
    typeof core[key] === "number" || core[key] === true;
  // Param tri-state cycle: undefined -> number(default) -> false -> undefined
  const cycleParam = (key, defNum) => {
    const cur = core[key];
    if (typeof cur === "number" || cur === true) {
      setCore(key, false);
    } else if (cur === false) {
      setCore(key, undefined);
    } else {
      if (Number.isFinite(defNum)) setCore(key, defNum);
      else setCore(key, true);
    }
  };
  const onParamNumberChange =
    (key, clampMin = 1, clampMax = 12) =>
    (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isFinite(v)) {
        const n = Math.max(clampMin, Math.min(clampMax, v));
        setCore(key, n);
      }
    };

  return (
    <div className="block" style={{ marginTop: 12 }}>
      <div className="block__header">Ability Controls</div>
      <div className="block__body">
        <div className="flags-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <label className="flag-item" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={factionMode === "custom"}
              onChange={toggleFactionCustom}
            />
            <span>Faction (Custom)</span>
            {factionMode === "custom" && (
              <input
                type="text"
                placeholder="Faction ability name"
                defaultValue={factionText}
                onBlur={onFactionTextBlur}
                style={{ width: 220 }}
              />
            )}
          </label>
        </div>

        <div className="flags-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          {[
            ["Deep Strike", "deepStrike"],
            ["Lone Operative", "loneOperative"],
            ["Fights First", "fightsFirst"],
            ["Stealth", "stealth"],
            ["Infiltrators", "infiltrators"],
            ["Advance and Charge", "advanceAndCharge"],
            ["Deadly Demise", "deadlyDemise"],
          ].map(([label, key]) => {
            const checked = isCoreChecked(key);
            const disabledState = core[key] === false;
            return (
              <button
                key={key}
                type="button"
                className={`chip-toggle ${checked ? "on" : ""} ${disabledState ? "disabled" : ""}`}
                onClick={() => cycleCore(key)}
                aria-pressed={checked}
                data-state={
                  disabledState ? "disabled" : checked ? "on" : "default"
                }
              >
                <span className="chip-body">{label}</span>
              </button>
            );
          })}
        </div>
        <div
          className="flags-row"
          style={{ flexWrap: "wrap", gap: "0.5rem", marginTop: 8 }}
        >
          {/* Scouts */}
          {(() => {
            const key = "scouts";
            const checked = isParamChecked(key);
            const disabledState = core[key] === false;
            const val = typeof core[key] === "number" ? core[key] : 6;
            return (
              <div className="param-toggle">
                <button
                  type="button"
                  className={`chip-toggle ${checked ? "on" : ""} ${disabledState ? "disabled" : ""}`}
                  onClick={() => cycleParam(key, 6)}
                  aria-pressed={checked}
                  data-state={
                    disabledState ? "disabled" : checked ? "on" : "default"
                  }
                >
                  <span className="chip-body">Scouts</span>
                </button>
                {checked && (
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={val}
                    onChange={onParamNumberChange(key, 1, 24)}
                    style={{ width: 56 }}
                  />
                )}
              </div>
            );
          })()}
          {/* Feel No Pain */}
          {(() => {
            const key = "feelNoPain";
            const checked = isParamChecked(key);
            const disabledState = core[key] === false;
            const val = typeof core[key] === "number" ? core[key] : 6;
            return (
              <div className="param-toggle">
                <button
                  type="button"
                  className={`chip-toggle ${checked ? "on" : ""} ${disabledState ? "disabled" : ""}`}
                  onClick={() => cycleParam(key, 6)}
                  aria-pressed={checked}
                  data-state={
                    disabledState ? "disabled" : checked ? "on" : "default"
                  }
                >
                  <span className="chip-body">Feel No Pain</span>
                </button>
                {checked && (
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={val}
                    onChange={onParamNumberChange(key, 2, 6)}
                    style={{ width: 56 }}
                  />
                )}
              </div>
            );
          })()}
        </div>

        {/* No named ability overrides */}
      </div>
    </div>
  );
};

const UnitDatasheet = ({
  unit,
  isSelected,
  onClick,
  overrides,
  allUnits = [],
  onUpdateOverrides,
  isLeaderUnit,
  canLeaderAttachToUnit,
  onAttachUnit,
  // Attack Helper props
  attackHelper,
  onToggleWeapon,
  onCloseAttackHelper,
  onChangeModelsInRange,
  onToggleExpected,
  selectedTargetUnit,
}) => {
  // Group identical weapons for display (parser now expands to 1 entry per weapon instance)
  const groupedWeapons = useMemo(() => {
    const list = Array.isArray(unit.weapons) ? unit.weapons : [];
    const map = new Map();
    const keyOf = (w) => {
      const name = w.name || "";
      const range =
        w.range === "Melee" || w.type === "Melee" ? "Melee" : w.range || '12"';
      const type = w.type || (range === "Melee" ? "Melee" : "Assault 1");
      const attacks = w.attacks ?? 1;
      const skill = w.skill ?? 3;
      const strength = w.strength ?? 4;
      const ap = w.ap ?? 0;
      const damage = w.damage ?? 1;
      return `${name}|${range}|${type}|${attacks}|${skill}|${strength}|${ap}|${damage}`;
    };
    list.forEach((w) => {
      const k = keyOf(w);
      const existing = map.get(k);
      if (existing) {
        existing.count = existing.count ? existing.count + 1 : 2;
      } else {
        const initial = { ...w };
        if (Number.isFinite(w.count) && w.count > 0) initial.count = w.count;
        map.set(k, initial);
      }
    });
    return Array.from(map.values());
  }, [unit?.weapons]);

  // Separate grouped weapons by type
  const rangedWeapons = groupedWeapons.filter(
    (weapon) => weapon.type !== "Melee" && weapon.range !== "Melee",
  );

  const meleeWeapons = groupedWeapons.filter(
    (weapon) => weapon.type === "Melee" || weapon.range === "Melee",
  );

  // Helpers
  // Leaders in same column (use override-aware isLeaderUnit)
  const leadersInColumn = useMemo(() => {
    if (!unit) return [];
    return (allUnits || [])
      .filter((u) => u && u.id !== unit.id && u.column === unit.column)
      .filter((u) => isLeaderUnit?.(u))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [allUnits, unit, isLeaderUnit]);

  // Eligible attach options from same column (ignore leader heuristic; rely on pair eligibility)
  const eligibleLeaders = useMemo(() => {
    if (!unit) return [];
    const candidates = (allUnits || []).filter(
      (u) => u && u.id !== unit.id && u.column === unit.column,
    );
    return candidates.filter((ldr) => canLeaderAttachToUnit?.(ldr, unit));
  }, [allUnits, unit, canLeaderAttachToUnit]);

  // For numeric stats that render with a trailing '+' (e.g., Sv, Ld, WS/BS)
  const getPlusStat = (stat, defaultValue = "-") => {
    return stat !== undefined && stat !== null ? `${stat}+` : defaultValue;
  };
  // Back-compat alias for existing calls in weapon rows
  const getStatValue = getPlusStat;

  // Leader flag for the viewed unit (compute unconditionally; guard inside)
  const unitIsLeader = useMemo(() => {
    if (!unit) return false;
    return isLeaderUnit?.(unit) ?? false;
  }, [isLeaderUnit, unit]);

  // Faction ability (from parser) and Core rules (subset of unit.rules)
  const factionAbility = useMemo(() => {
    if (!unit) return null;
    return unit.factionAbilityName || null;
  }, [unit]);

  const coreRules = useMemo(() => {
    if (!unit) return [];
    const names = Array.from(
      new Set((unit.rules || []).map((n) => String(n).trim())),
    );
    const prefixes = [
      "deep strike",
      "deadly demise",
      "lone operative",
      "fights first",
      "stealth",
      "scout", // also matches "Scouts 6\""
      "scouts",
      "feel no pain",
      "infiltrators",
      "advance and charge",
    ];
    return names
      .filter(
        (n) =>
          !factionAbility ||
          n.toLowerCase() !== String(factionAbility).toLowerCase(),
      )
      .filter((n) => {
        const lower = n.toLowerCase();
        // Avoid weapon-only keywords in header
        if (
          lower.startsWith("lethal hits") ||
          lower.startsWith("devastating wounds")
        )
          return false;
        return prefixes.some((p) => lower.startsWith(p));
      });
  }, [unit, factionAbility]);

  // No header abilities list needed; bottom panel covers full abilities

  // Apply overrides to faction/core/named for display in header
  const effFactionAbility = useMemo(() => {
    const f = overrides?.abilities?.faction;
    if (typeof f === "string" && f.trim()) return f.trim();
    // Ignore legacy hide=false; always show base faction when no custom text
    return factionAbility;
  }, [overrides?.abilities, factionAbility]);

  // Fallback: infer faction rule from unit.rules if not present on the unit
  const inferredFactionFromRules = useMemo(() => {
    const rules = (unit?.rules || []).map((r) => String(r).toLowerCase());
    const known = [
      "oath of moment", // Space Marines
      "blessings of khorne", // World Eaters
      "synaptic imperative", // Tyranids (example)
      "army of renown",
      "miracle dice", // Adepta Sororitas
    ];
    const found = known.find((k) => rules.some((r) => r.includes(k)));
    return found ? found.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  }, [unit?.rules]);

  const effCoreRules = useMemo(() => {
    const list = Array.from(coreRules);
    const ov = overrides?.abilities || {};
    const core = ov.core || {};
    const removeStartsWith = (label) => {
      const i = list.findIndex(
        (s) => s && s.toLowerCase().startsWith(label.toLowerCase()),
      );
      if (i !== -1) list.splice(i, 1);
    };
    const ensurePresent = (text) => {
      if (!list.some((s) => s.toLowerCase() === text.toLowerCase()))
        list.push(text);
    };
    // Toggles
    if (core.deepStrike === false) removeStartsWith("Deep Strike");
    else if (
      core.deepStrike === true &&
      !list.some((s) => s.toLowerCase().startsWith("deep strike"))
    )
      ensurePresent("Deep Strike");

    if (core.loneOperative === false) removeStartsWith("Lone Operative");
    else if (
      core.loneOperative === true &&
      !list.some((s) => s.toLowerCase().startsWith("lone operative"))
    )
      ensurePresent("Lone Operative");

    if (core.fightsFirst === false) removeStartsWith("Fights First");
    else if (
      core.fightsFirst === true &&
      !list.some((s) => s.toLowerCase().startsWith("fights first"))
    )
      ensurePresent("Fights First");

    if (core.stealth === false) removeStartsWith("Stealth");
    else if (
      core.stealth === true &&
      !list.some((s) => s.toLowerCase().startsWith("stealth"))
    )
      ensurePresent("Stealth");

    // Parametric (Scouts)
    if (core.scouts === false) removeStartsWith("Scouts");
    else if (typeof core.scouts === "number" && Number.isFinite(core.scouts)) {
      removeStartsWith("Scouts");
      ensurePresent(`Scouts ${core.scouts}\"`);
    } else if (typeof core.scouts === "string" && core.scouts.trim()) {
      removeStartsWith("Scouts");
      ensurePresent(core.scouts.trim());
    } else if (
      core.scouts === true &&
      !list.some((s) => s.toLowerCase().startsWith("scouts"))
    ) {
      ensurePresent('Scouts 6"');
    }

    if (core.deadlyDemise === false) removeStartsWith("Deadly Demise");
    else if (
      typeof core.deadlyDemise === "string" &&
      core.deadlyDemise.trim()
    ) {
      removeStartsWith("Deadly Demise");
      ensurePresent(core.deadlyDemise.trim());
    } else if (
      core.deadlyDemise === true &&
      !list.some((s) => s.toLowerCase().startsWith("deadly demise"))
    ) {
      ensurePresent("Deadly Demise D6");
    }

    if (core.feelNoPain === false) removeStartsWith("Feel No Pain");
    else if (
      typeof core.feelNoPain === "number" &&
      Number.isFinite(core.feelNoPain)
    ) {
      removeStartsWith("Feel No Pain");
      ensurePresent(`Feel No Pain ${core.feelNoPain}+`);
    } else if (typeof core.feelNoPain === "string" && core.feelNoPain.trim()) {
      removeStartsWith("Feel No Pain");
      ensurePresent(core.feelNoPain.trim());
    } else if (
      core.feelNoPain === true &&
      !list.some((s) => s.toLowerCase().startsWith("feel no pain"))
    ) {
      ensurePresent("Feel No Pain 6+");
    }

    if (core.infiltrators === false) removeStartsWith("Infiltrators");
    else if (
      core.infiltrators === true &&
      !list.some((s) => s.toLowerCase().startsWith("infiltrators"))
    ) {
      ensurePresent("Infiltrators");
    }

    if (core.advanceAndCharge === false) removeStartsWith("Advance and Charge");
    else if (
      core.advanceAndCharge === true &&
      !list.some((s) => s.toLowerCase().startsWith("advance and charge"))
    ) {
      ensurePresent("Advance and Charge");
    }

    // Exclude weapon keywords defensively
    return list.filter((n) => {
      const lower = n.toLowerCase();
      if (lower.startsWith("lethal hits")) return false;
      if (lower.startsWith("devastating wounds")) return false;
      return true;
    });
  }, [coreRules, overrides?.abilities]);

  // No named ability overrides

  // Guard after hooks to satisfy rules-of-hooks
  if (!unit) return null;

  // Attack Helper now renders above the datasheet in GameSession

  return (
    <div
      className={`unit-datasheet ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      {/* Unit Header */}
      <div className="datasheet-header">
        <div className="unit-title">
          <h2>{unit.name}</h2>
          <div className="unit-size">
            {unit.models} {unit.models === 1 ? "model" : "models"}
          </div>
        </div>
        <div
          className="abilities-inline header-pills"
          aria-label="Header pills"
        >
          <div className="ability-pill" title={(effCoreRules || []).join(", ")}>
            <span className="ability-key">Core:</span>
            <span className="ability-value">
              {Array.isArray(effCoreRules) && effCoreRules.length > 0
                ? effCoreRules.join(", ")
                : "—"}
            </span>
          </div>
          <div
            className="ability-pill"
            title={(unit.keywords || []).join(", ")}
          >
            <span className="ability-key">Keywords:</span>
            <span className="ability-value">
              {Array.isArray(unit.keywords) && unit.keywords.length > 0
                ? unit.keywords.join(", ")
                : "—"}
            </span>
          </div>
        </div>

        {/* Unit Stats */}
        <div className="unit-stats-row">
          <div className="stat-box">
            <div className="stat-label">M</div>
            <div className="stat-value">{unit.move || '6"'}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">T</div>
            <div className="stat-value">{unit.toughness || 4}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Sv</div>
            <div className="stat-value">
              {getPlusStat(unit.armor_save, "3+")}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">W</div>
            <div className="stat-value">{unit.wounds || 1}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Ld</div>
            <div className="stat-value">
              {getPlusStat(unit.leadership, "7+")}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">OC</div>
            <div className="stat-value">{unit.oc ?? 1}</div>
          </div>
        </div>
      </div>

      <div className="datasheet-content">
        {/* Attack Helper moved above this panel (see GameSession) */}
        {/* Ranged Weapons */}
        {rangedWeapons.length > 0 && (
          <div className="weapons-section">
            <div className="section-header ranged-header">
              <span className="weapon-icon">🎯</span>
              <span>RANGED WEAPONS</span>
            </div>
            <div className="weapons-table">
              <div className="weapons-table-header">
                <div className="weapon-name-col">WEAPON</div>
                <div className="weapon-stat-col">RANGE</div>
                <div className="weapon-stat-col">A</div>
                <div className="weapon-stat-col">BS</div>
                <div className="weapon-stat-col">S</div>
                <div className="weapon-stat-col">AP</div>
                <div className="weapon-stat-col">D</div>
              </div>
              {rangedWeapons.map((weapon, index) => (
                <React.Fragment key={`ranged-${index}`}>
                  {(() => {
                    const isRowSelected =
                      attackHelper?.attackerUnitId === unit.id &&
                      attackHelper?.section === "ranged" &&
                      attackHelper?.index === index;
                    return (
                      <div
                        className={`weapon-row ${isRowSelected ? "row--selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-expanded={isRowSelected || undefined}
                        aria-current={isRowSelected ? "true" : undefined}
                        onClick={() =>
                          onToggleWeapon?.("ranged", index, weapon)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            onToggleWeapon?.("ranged", index, weapon);
                        }}
                      >
                        <div className="weapon-name-col">
                          <div className="weapon-name">{weapon.name}</div>
                          {Array.isArray(weapon.keywords) &&
                            weapon.keywords.length > 0 && (
                              <div
                                className="weapon-tags"
                                title={weapon.keywords.join(", ")}
                              >
                                {weapon.keywords.map((k, i) => (
                                  <span key={i} className="weapon-tag">
                                    {String(k).toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                          {weapon.count > 1 && (
                            <div className="weapon-count">
                              (x{weapon.count})
                            </div>
                          )}
                        </div>
                        <div className="weapon-stat-col">{weapon.range}</div>
                        <div className="weapon-stat-col">{weapon.attacks}</div>
                        <div className="weapon-stat-col">
                          {getStatValue(weapon.skill, "3+")}
                        </div>
                        <div className="weapon-stat-col">{weapon.strength}</div>
                        <div className="weapon-stat-col">{weapon.ap}</div>
                        <div className="weapon-stat-col">{weapon.damage}</div>
                      </div>
                    );
                  })()}
                  {/* weapon row click just selects; panel stays pinned at top */}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Melee Weapons */}
        {meleeWeapons.length > 0 && (
          <div className="weapons-section">
            <div className="section-header melee-header">
              <span className="weapon-icon">⚔️</span>
              <span>MELEE WEAPONS</span>
            </div>
            <div className="weapons-table">
              <div className="weapons-table-header">
                <div className="weapon-name-col">WEAPON</div>
                <div className="weapon-stat-col">RANGE</div>
                <div className="weapon-stat-col">A</div>
                <div className="weapon-stat-col">WS</div>
                <div className="weapon-stat-col">S</div>
                <div className="weapon-stat-col">AP</div>
                <div className="weapon-stat-col">D</div>
              </div>
              {meleeWeapons.map((weapon, index) => (
                <React.Fragment key={`melee-${index}`}>
                  {(() => {
                    const isRowSelected =
                      attackHelper?.attackerUnitId === unit.id &&
                      attackHelper?.section === "melee" &&
                      attackHelper?.index === index;
                    return (
                      <div
                        className={`weapon-row ${isRowSelected ? "row--selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-expanded={isRowSelected || undefined}
                        aria-current={isRowSelected ? "true" : undefined}
                        onClick={() => onToggleWeapon?.("melee", index, weapon)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            onToggleWeapon?.("melee", index, weapon);
                        }}
                      >
                        <div className="weapon-name-col">
                          <div className="weapon-name">{weapon.name}</div>
                          {Array.isArray(weapon.keywords) &&
                            weapon.keywords.length > 0 && (
                              <div
                                className="weapon-tags"
                                title={weapon.keywords.join(", ")}
                              >
                                {weapon.keywords.map((k, i) => (
                                  <span key={i} className="weapon-tag">
                                    {String(k).toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                          {weapon.count > 1 && (
                            <div className="weapon-count">
                              (x{weapon.count})
                            </div>
                          )}
                        </div>
                        <div className="weapon-stat-col">Melee</div>
                        <div className="weapon-stat-col">{weapon.attacks}</div>
                        <div className="weapon-stat-col">
                          {getStatValue(weapon.skill, "3+")}
                        </div>
                        <div className="weapon-stat-col">{weapon.strength}</div>
                        <div className="weapon-stat-col">{weapon.ap}</div>
                        <div className="weapon-stat-col">{weapon.damage}</div>
                      </div>
                    );
                  })()}
                  {/* weapon row click just selects; panel stays pinned at top */}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Core rules now shown in header; bottom block removed per user request */}

        <div className="datasheet-bottom">
          {/* Abilities */}
          <Collapsible title="Abilities" defaultOpen={false} centerTitle>
            {unit.abilities && unit.abilities.length > 0 ? (
              unit.abilities.map((ability, index) => (
                <div key={index} className="ability-item">
                  <div className="ability-name">
                    {sanitizeRichText(ability.name)}:
                  </div>
                  <div className="ability-description">
                    {sanitizeRichText(ability.description)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">No abilities.</div>
            )}
          </Collapsible>

          {/* Unit Composition */}
          <Collapsible title="Unit Composition" defaultOpen={false} centerTitle>
            {unit.modelGroups && unit.modelGroups.length > 0 ? (
              <>
                {unit.modelGroups.map((group, index) => (
                  <div key={index} className="composition-item">
                    • {group.count}x {group.name}
                  </div>
                ))}
                <div className="points-cost">
                  {unit.models} models - {unit.points} pts
                </div>
              </>
            ) : (
              <div className="empty">No composition data.</div>
            )}
          </Collapsible>

          {/* Leadership Overrides - Compact Collapsible */}
          <OverridesCollapsible
            unit={unit}
            overrides={overrides}
            allUnits={allUnits}
            onUpdateOverrides={onUpdateOverrides}
          />

          {/* Attach to Leader (moved to bottom) */}
          {!unitIsLeader && eligibleLeaders.length > 0 && (
            <div className="attach-panel" style={{ marginTop: 12 }}>
              <div
                className="section-header"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span className="weapon-icon">🤝</span>
                <span>ATTACH TO A LEADER</span>
              </div>
              <div
                className="attach-actions"
                style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
              >
                {eligibleLeaders.map((ldr) => (
                  <button
                    key={ldr.id}
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAttachUnit?.(ldr.id, unit.id);
                    }}
                    title={`Attach ${unit.name} to ${ldr.name}`}
                  >
                    Attach to {ldr.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OverridesCollapsible = ({
  unit,
  overrides,
  allUnits,
  onUpdateOverrides,
}) => {
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let n = 0;
    if (overrides?.canLead && overrides.canLead !== "auto") n += 1;
    if (overrides?.canBeLed && overrides.canBeLed !== "auto") n += 1;
    n += overrides?.allowList?.length || 0;
    // abilities sub-count
    try {
      const ab = overrides?.abilities;
      if (ab) {
        // Count faction only when custom string provided
        if (typeof ab.faction === "string" && ab.faction.trim()) n += 1;
        // Count core only when explicitly enabled or set to a value (not false/undefined)
        if (ab.core)
          n += Object.keys(ab.core).filter(
            (k) => ab.core[k] !== undefined && ab.core[k] !== false,
          ).length;
        // Named deprecated: only count truthy enabled flags
        if (ab.named)
          n += Object.keys(ab.named).filter((k) => ab.named[k] === true).length;
      }
    } catch (_) {}
    return n;
  }, [overrides]);

  const statusText = activeCount > 0 ? `Overridden (${activeCount})` : "Off";
  const statusClass = activeCount > 0 ? "overridden" : "off";

  const onToggleLead = (checked) => {
    onUpdateOverrides?.({ canLead: checked ? "yes" : "auto" });
  };
  const onToggleLed = (checked) => {
    onUpdateOverrides?.({ canBeLed: checked ? "yes" : "auto" });
  };

  const onReset = () => {
    onUpdateOverrides?.({
      canLead: "auto",
      canBeLed: "auto",
      allowList: [],
      abilities: undefined,
    });
  };

  return (
    <div className="overrides-collapsible">
      <button
        type="button"
        className="overrides-header center"
        onClick={() => setOpen(!open)}
      >
        <span className={`chevron ${open ? "open" : ""}`}>▸</span>
        <span>Override</span>
        <span className={`status-chip ${statusClass}`}>{statusText}</span>
      </button>
      {open && (
        <div className="overrides-panel">
          <div className="flags-row" role="group" aria-label="Override flags">
            <label className="flag-item" aria-label="Can lead">
              <input
                type="checkbox"
                checked={overrides?.canLead === "yes"}
                onChange={(e) => onToggleLead(e.target.checked)}
              />
              <span>Can lead</span>
            </label>
            <label className="flag-item" aria-label="Can be led">
              <input
                type="checkbox"
                checked={overrides?.canBeLed === "yes"}
                onChange={(e) => onToggleLed(e.target.checked)}
              />
              <span>Can be led</span>
            </label>
          </div>

          <PairwiseControls
            unit={unit}
            allUnits={allUnits}
            overrides={overrides}
            onUpdateOverrides={onUpdateOverrides}
          />

          <AbilityOverrides
            overrides={overrides}
            onUpdateOverrides={onUpdateOverrides}
          />

          <div className="override-actions">
            <button type="button" className="btn-secondary" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PairwiseControls = ({ unit, allUnits, overrides, onUpdateOverrides }) => {
  const [allowSelect, setAllowSelect] = useState("");
  const unitOptions = useMemo(() => {
    return allUnits
      .filter((u) => u.id !== unit.id)
      .map((u) => ({ id: u.id, name: u.name }));
  }, [allUnits, unit.id]);

  const addAllow = () => {
    if (!allowSelect) return;
    const next = Array.from(
      new Set([...(overrides?.allowList || []), allowSelect]),
    );
    onUpdateOverrides?.({ allowList: next });
    setAllowSelect("");
  };
  const removeAllow = (id) => {
    const next = (overrides?.allowList || []).filter((x) => x !== id);
    onUpdateOverrides?.({ allowList: next });
  };

  return (
    <div className="pairwise-overrides single">
      <div className="pair-column" aria-label="Allow specific pairings">
        <label htmlFor="allow-search">Allow specific pairings</label>
        <div className="pair-add-row">
          <select
            aria-label="Select unit to allow"
            value={allowSelect}
            onChange={(e) => setAllowSelect(e.target.value)}
          >
            <option value="">Select a unit…</option>
            {(unitOptions || []).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={addAllow}>
            Add
          </button>
        </div>
        <div className="chips" role="group" aria-label="Allowed list">
          {(overrides?.allowList || []).map((id) => {
            const u = allUnits.find((x) => x.id === id);
            return (
              <span key={id} className="chip">
                {u ? u.name : id}
                <button
                  type="button"
                  aria-label={`Remove ${u ? u.name : id} from allow list`}
                  onClick={() => removeAllow(id)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UnitDatasheet;

// Generic collapsible used for Abilities and Unit Composition
const Collapsible = ({
  title,
  defaultOpen = false,
  centerTitle = false,
  children,
}) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overrides-collapsible">
      <button
        type="button"
        className={`overrides-header ${centerTitle ? "center" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span className={`chevron ${open ? "open" : ""}`}>▸</span>
        <span>{title}</span>
      </button>
      {open && <div className="overrides-panel">{children}</div>}
    </div>
  );
};
