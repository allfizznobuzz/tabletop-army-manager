import React, { useMemo, useState } from "react";
import {
  woundTarget,
  probabilityFromTarget,
  parseDiceNotation,
  bestSaveTargetAfterAp,
} from "../utils/attackMath";
import "./UnitDatasheet.css";

const UnitDatasheet = ({
  unit,
  isSelected,
  onClick,
  overrides,
  allUnits = [],
  onUpdateOverrides,
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
        existing.count = (existing.count || 1) + 1;
      } else {
        map.set(k, { ...w, count: w.count || 1 });
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

  // Get unit stats for header
  const getStatValue = (stat, defaultValue = "-") => {
    return stat !== undefined ? `${stat}+` : defaultValue;
  };

  // Guard after hooks to satisfy rules-of-hooks
  if (!unit) return null;

  const isOpen = (section, index) =>
    !!(
      attackHelper?.open &&
      attackHelper.section === section &&
      attackHelper.index === index
    );

  const toHitTarget = (weapon, section) => {
    // Use weapon.skill if provided, else fallback to unit BS/WS
    const skill = weapon?.skill;
    if (typeof skill === "number" && skill >= 2 && skill <= 6) return skill;
    if (section === "ranged") {
      const bs = Number(unit.ballistic_skill || 0);
      return bs >= 2 && bs <= 6 ? bs : null;
    }
    const ws = Number(unit.weapon_skill || 0);
    return ws >= 2 && ws <= 6 ? ws : null;
  };

  const renderAttackHelper = (weapon, section, index) => {
    if (!isOpen(section, index)) return null;

    const modelsInRange = attackHelper?.modelsInRange || unit.models || 1;
    const A = weapon?.attacks;
    const AParsed = parseDiceNotation(A);
    const sVal = Number(weapon?.strength || unit.strength || 0);
    const tVal = Number(selectedTargetUnit?.toughness || 0);
    const woundT = tVal ? woundTarget(sVal, tVal) : null;
    const toHitT = toHitTarget(weapon, section);
    const toHitP = toHitT ? probabilityFromTarget(toHitT) : null;
    const woundP = woundT ? probabilityFromTarget(woundT) : null;
    const armour = selectedTargetUnit?.armor_save;
    const invuln = selectedTargetUnit?.invulnerable_save;
    const ap = Number(weapon?.ap || 0);
    const bestSv = bestSaveTargetAfterAp(armour, ap, invuln);
    const damage = weapon?.damage;

    const formatPct = (p) => (p == null ? "" : `(p≈${(p * 100).toFixed(1)}%)`);

    // total attacks for fixed values include modelsInRange
    let totalAttacks = null;
    if (AParsed.kind === "fixed") {
      totalAttacks = Number(AParsed.value || 0) * modelsInRange;
    }

    const apMod = Math.abs(Number(ap || 0));

    return (
      <div className="attack-helper-panel" role="region" aria-label="Attack Helper">
        <div className="attack-helper-header">
          <div className="attack-helper-title">Attack Helper — {weapon?.name}</div>
          <button
            type="button"
            className="overlay-close"
            aria-label="Close Attack Helper"
            onClick={() => onCloseAttackHelper?.()}
          >
            ×
          </button>
        </div>
        <div className="attack-helper-grid">
          <div className="helper-section">
            <div className="helper-label">Attacks</div>
            {AParsed.kind === "fixed" ? (
              <div className="helper-value">{totalAttacks ?? "—"}</div>
            ) : (
              <div className="helper-value">
                Roll {AParsed.value} to determine attacks
                <div className="helper-sub">
                  Avg: {((AParsed.avg || 0) * modelsInRange).toFixed(1)}; Range: {(AParsed.min || 0) * modelsInRange}
                  –{(AParsed.max || 0) * modelsInRange}
                </div>
              </div>
            )}
            <label className="models-input-row">
              <span>Models in range/engaged</span>
              <input
                type="number"
                min={1}
                aria-label="Models in range"
                value={modelsInRange}
                onChange={(e) => onChangeModelsInRange?.(e.target.value)}
              />
            </label>
          </div>

          <div className="helper-section">
            <div className="helper-label">To Hit</div>
            <div className="helper-value">
              {toHitT ? (
                <>
                  {toHitT}+
                  <span className="helper-sub"> {formatPct(toHitP)}</span>
                </>
              ) : (
                <>
                  — <span className="missing-chip">missing</span>
                </>
              )}
            </div>
          </div>

          <div className="helper-section">
            <div className="helper-label">To Wound</div>
            <div className="helper-value">
              {woundT ? (
                <>
                  {woundT}+
                  <span className="helper-sub"> {formatPct(woundP)}</span>
                </>
              ) : (
                <>
                  — <span className="missing-chip">missing</span>
                </>
              )}
            </div>
          </div>

          <div className="helper-section">
            <div className="helper-label">Defender Save</div>
            <div className="helper-value">
              {bestSv ? (
                <>
                  <div className="save-row">
                    <span className={`save-pill ${bestSv === bestSaveTargetAfterAp(armour, ap, null) ? "best" : ""}`}>
                      Armour{apMod ? ` (mod +${apMod})` : ""}: {bestSaveTargetAfterAp(armour, ap, null) || "—"}+
                    </span>
                    {invuln ? (
                      <span className={`save-pill ${bestSv === Number(String(invuln).replace(/[^0-9]/g, "")) ? "best" : ""}`}>
                        Invuln: {Number(String(invuln).replace(/[^0-9]/g, ""))}+
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  — <span className="missing-chip">missing</span>
                </>
              )}
            </div>
            {damage ? (
              <div className="helper-sub">Each failed save: {String(damage)}</div>
            ) : null}
          </div>
        </div>

        {/* Expected results toggle and summary */}
        <div className="helper-section" style={{ marginTop: '0.5rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <input
              type="checkbox"
              aria-label="Show expected results"
              checked={!!attackHelper?.showExpected}
              onChange={() => onToggleExpected?.()}
            />
            Show expected results
          </label>
          {attackHelper?.showExpected ? (
            (() => {
              const attacksAvg =
                AParsed.kind === 'fixed'
                  ? Number(AParsed.value || 0) * modelsInRange
                  : (Number(AParsed.avg || 0) * modelsInRange);
              const pHit = toHitP ?? 0;
              const pWound = woundP ?? 0;
              const pSave = bestSv ? (probabilityFromTarget(bestSv) || 0) : 0;
              const pFail = 1 - pSave;
              const dmgParsed = parseDiceNotation(damage);
              const dmgAvg = dmgParsed.kind === 'fixed' ? Number(dmgParsed.value || 0) : Number(dmgParsed.avg || 0);
              const expHits = attacksAvg * pHit;
              const expWounds = expHits * pWound;
              const expUnsaved = expWounds * pFail;
              const expDamage = expUnsaved * dmgAvg;
              return (
                <div className="helper-sub" aria-label="Expected results">
                  Expected hits: {expHits.toFixed(1)} • Expected wounds: {expWounds.toFixed(1)} • Expected unsaved: {expUnsaved.toFixed(1)} • Expected damage: {expDamage.toFixed(1)}
                </div>
              );
            })()
          ) : null}
        </div>
      </div>
    );
  };

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

        {/* Unit Stats */}
        <div className="unit-stats-row">
          <div className="stat-box">
            <div className="stat-label">M</div>
            <div className="stat-value">12"</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">T</div>
            <div className="stat-value">{unit.toughness || 4}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Sv</div>
            <div className="stat-value">
              {getStatValue(unit.armor_save, "3+")}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">W</div>
            <div className="stat-value">{unit.wounds || 1}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Ld</div>
            <div className="stat-value">6+</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">OC</div>
            <div className="stat-value">1</div>
          </div>
        </div>
      </div>

      <div className="datasheet-content">
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
                  <div
                    className="weapon-row"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen("ranged", index)}
                    onClick={() => onToggleWeapon?.("ranged", index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onToggleWeapon?.("ranged", index);
                    }}
                  >
                  <div className="weapon-name-col">
                    <div className="weapon-name">{weapon.name}</div>
                    {weapon.count > 1 && (
                      <div className="weapon-count">(x{weapon.count})</div>
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
                  {renderAttackHelper(weapon, "ranged", index)}
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
                  <div
                    className="weapon-row"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen("melee", index)}
                    onClick={() => onToggleWeapon?.("melee", index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onToggleWeapon?.("melee", index);
                    }}
                  >
                  <div className="weapon-name-col">
                    <div className="weapon-name">{weapon.name}</div>
                    {weapon.count > 1 && (
                      <div className="weapon-count">(x{weapon.count})</div>
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
                  {renderAttackHelper(weapon, "melee", index)}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="datasheet-bottom">
          {/* Abilities */}
          {unit.abilities && unit.abilities.length > 0 && (
            <div className="abilities-section">
              <div className="section-header abilities-header">ABILITIES</div>
              <div className="abilities-content">
                {unit.abilities.map((ability, index) => (
                  <div key={index} className="ability-item">
                    <div className="ability-name">{ability.name}:</div>
                    <div className="ability-description">
                      {ability.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unit Composition */}
          {unit.modelGroups && unit.modelGroups.length > 0 && (
            <div className="composition-section">
              <div className="section-header composition-header">
                UNIT COMPOSITION
              </div>
              <div className="composition-content">
                {unit.modelGroups.map((group, index) => (
                  <div key={index} className="composition-item">
                    • {group.count}x {group.name}
                  </div>
                ))}
                <div className="points-cost">
                  {unit.models} models - {unit.points} pts
                </div>
              </div>
            </div>
          )}

          {/* Keywords */}
          {unit.keywords && unit.keywords.length > 0 && (
            <div className="keywords-section">
              <div className="keywords-header">
                <span className="keywords-label">KEYWORDS:</span>
                <span className="keywords-list">
                  {unit.keywords.join(", ").toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Leadership Overrides - Compact Collapsible */}
          <OverridesCollapsible
            unit={unit}
            overrides={overrides}
            allUnits={allUnits}
            onUpdateOverrides={onUpdateOverrides}
          />
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
    onUpdateOverrides?.({ canLead: "auto", canBeLed: "auto", allowList: [] });
  };

  return (
    <div className="overrides-collapsible">
      <button
        type="button"
        className="overrides-header"
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
