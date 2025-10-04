import React, { useState } from "react";
import {
  woundTarget,
  probabilityFromTarget,
  parseDiceNotation,
  computeDefenderSave,
  parseAp,
  explainWoundRule,
} from "utils/attackMath";
import { resolveDefenderStats } from "utils/defenderResolver";

// Local helper to group weapons similar to GameSessionView.groupWeapons
const groupWeapons = (unit) => {
  const list = Array.isArray(unit?.weapons) ? unit.weapons : [];
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
      if (Number.isFinite(w.count) && w.count > 0) {
        initial.count = w.count;
      }
      map.set(k, initial);
    }
  });
  const grouped = Array.from(map.values());
  const ranged = grouped.filter(
    (w) => w.type !== "Melee" && w.range !== "Melee",
  );
  const melee = grouped.filter(
    (w) => w.type === "Melee" || w.range === "Melee",
  );
  return { ranged, melee };
};

const AttackHelperPanel = ({
  selectedUnit,
  attackHelper,
  allUnitsById,
  defaultTargetUnit,
  onChangeModelsInRange,
  onToggleExpected,
}) => {
  // Floating tooltip that follows the mouse
  const [tooltip, setTooltip] = useState({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  });
  const showTip = (text) => (e) =>
    setTooltip({
      visible: true,
      text: text || "",
      x: e.clientX + 12,
      y: e.clientY + 12,
    });
  const moveTip = (text) => (e) =>
    setTooltip((t) => ({
      ...t,
      visible: true,
      text: text || "",
      x: e.clientX + 12,
      y: e.clientY + 12,
    }));
  const hideTip = () => setTooltip((t) => ({ ...t, visible: false }));
  const tipHandlers = (text) =>
    text
      ? {
          onMouseEnter: showTip(text),
          onMouseMove: moveTip(text),
          onMouseLeave: hideTip,
        }
      : {};
  const attacker = attackHelper?.attackerUnitId
    ? allUnitsById[attackHelper.attackerUnitId]
    : selectedUnit;
  if (!attacker) return null;

  const { ranged, melee } = groupWeapons(attacker);
  const section = attackHelper?.section;
  const index = attackHelper?.index;
  const weapon =
    section === "ranged"
      ? ranged[index]
      : section === "melee"
        ? melee[index]
        : null;
  const modelsInRange = attackHelper?.modelsInRange || attacker.models || 1;
  // Now safe to derive stepper helpers
  const modelsVal = Number(modelsInRange || 1);
  const decModels = () => onChangeModelsInRange?.(Math.max(1, modelsVal - 1));
  const incModels = () => onChangeModelsInRange?.(modelsVal + 1);

  // to hit depends on weapon.skill override or unit base skill by section
  const toHitTarget = (weaponObj, sec) => {
    const skill = weaponObj?.skill;
    if (typeof skill === "number" && skill >= 2 && skill <= 6) return skill;
    if (sec === "ranged") {
      const bs = Number(attacker?.ballistic_skill || 0);
      return bs >= 2 && bs <= 6 ? bs : null;
    }
    const ws = Number(attacker?.weapon_skill || 0);
    return ws >= 2 && ws <= 6 ? ws : null;
  };

  const AParsed = parseDiceNotation(weapon?.attacks);
  const sVal = Number(weapon?.strength || attacker.strength || 0);
  const selectedTarget = attackHelper?.targetUnitId
    ? allUnitsById[attackHelper.targetUnitId]
    : defaultTargetUnit;
  const {
    toughness: tResolved,
    armourSave: svResolved,
    invulnSave,
  } = resolveDefenderStats(selectedTarget || {});
  const tVal = Number(tResolved || 0);
  const toHitT = weapon ? toHitTarget(weapon, section) : null;
  const toHitP = toHitT ? probabilityFromTarget(toHitT) : null;
  const woundT = tVal ? woundTarget(sVal, tVal) : null;
  const woundP = woundT ? probabilityFromTarget(woundT) : null;
  const woundRule = woundT ? explainWoundRule(sVal, tVal) : null;
  // Hover details
  const toHitSrc =
    weapon && typeof weapon.skill === "number"
      ? `Weapon skill ${weapon.skill}+`
      : section === "ranged"
        ? `BS ${attacker?.ballistic_skill ?? "—"}+`
        : `WS ${attacker?.weapon_skill ?? "—"}+`;
  const toHitHover =
    weapon && toHitT
      ? `${toHitSrc} → ${toHitT}+${
          toHitP != null ? `; p≈${(toHitP * 100).toFixed(1)}%` : ""
        }`
      : null;
  const woundHover =
    weapon && woundT
      ? `${woundRule || ""}${woundRule ? " " : ""}(S ${sVal} vs T ${tVal})${
          woundP != null ? `; p≈${(woundP * 100).toFixed(1)}%` : ""
        }`
      : null;
  const apInt = parseAp(weapon?.ap || 0);
  const breakdown = computeDefenderSave(svResolved, apInt, invulnSave);
  const bestSv = breakdown.best;
  const bestLabel = selectedTarget
    ? bestSv != null
      ? `${bestSv}+${breakdown.used === "invuln" ? " (Inv)" : ""}`
      : "—"
    : "—";
  const bestHint = selectedTarget
    ? bestSv != null
      ? breakdown.used === "invuln"
        ? `using invulnerable (${bestSv}+)`
        : `using armour after AP (${bestSv}+)`
      : "missing"
    : "select a target";
  const defSaveHover = weapon
    ? `Armour after AP: ${
        breakdown.armourAfterAp ? `${breakdown.armourAfterAp}+` : "—"
      }${svResolved ? ` (SV ${svResolved}+)` : ""} AP ${apInt || 0}; ` +
      `Invulnerable: ${invulnSave ? `${invulnSave}+` : "—"}`
    : null;

  let totalAttacks = null;
  if (AParsed.kind === "fixed")
    totalAttacks = Number(AParsed.value || 0) * modelsInRange;

  // Hover text for Attacks math
  let attacksHover = null;
  if (weapon) {
    if (AParsed.kind === "fixed") {
      const perModel = Number(AParsed.value || 0);
      const total = Number.isFinite(perModel) ? perModel * modelsInRange : null;
      attacksHover = `${modelsInRange} models × ${perModel} attacks = ${total ?? "—"}`;
    } else {
      const avgPer = Number(AParsed.avg || 0);
      const totalAvg = modelsInRange * avgPer;
      attacksHover = `${modelsInRange} models × avg(${AParsed.value}) ≈ ${totalAvg.toFixed(1)}`;
    }
  }

  const showHeaderNames = !!weapon;

  return (
    <section className="attack-helper is-sticky" aria-label="Attack Helper">
      <div className="helper-header">
        <div className="helper-name">Dice Calculator</div>
        <div className="helper-title">
          <span>Attacker:</span>
          <strong
            className={`attacker-name${showHeaderNames ? " active" : ""}`}
          >
            {showHeaderNames && attacker ? attacker.name : ""}
          </strong>
          {showHeaderNames ? <span className="sep">•</span> : null}
          <span>Defender:</span>
          <strong
            className={`defender-name${showHeaderNames ? " active" : ""}`}
          >
            {showHeaderNames && selectedTarget ? selectedTarget.name : ""}
          </strong>
          {showHeaderNames ? <span className="sep">•</span> : null}
          <span>Weapon:</span>
          <strong>{weapon ? weapon.name : "—"}</strong>
        </div>
      </div>
      {tooltip.visible ? (
        <div
          className="app-tooltip"
          style={{ position: "fixed", top: tooltip.y, left: tooltip.x }}
          role="tooltip"
        >
          {tooltip.text}
        </div>
      ) : null}
      <div className="helper-grid">
        <div className="helper-cell">
          <div className="section-title">Models</div>
          <div className="value">
            <div
              className="number-stepper"
              role="group"
              aria-label="Models selector"
            >
              <button
                type="button"
                className="btn-step"
                aria-label="Decrease models"
                onClick={decModels}
              >
                −
              </button>
              <input
                className="models-input"
                type="number"
                min={1}
                aria-label="Models in range"
                value={modelsInRange}
                onChange={(e) => onChangeModelsInRange?.(e.target.value)}
              />
              <button
                type="button"
                className="btn-step"
                aria-label="Increase models"
                onClick={incModels}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div
          className="helper-cell"
          {...(weapon ? tipHandlers(attacksHover) : {})}
        >
          <div className="section-title">Attacks</div>
          <div className="value">
            {weapon ? (
              AParsed.kind === "fixed" ? (
                <span className="primary-number">{totalAttacks ?? "—"}</span>
              ) : (
                <span className="primary-number">{`Roll ${AParsed.value}`}</span>
              )
            ) : (
              <>
                — <span className="meta">select a weapon</span>
              </>
            )}
          </div>
        </div>

        <div
          className="helper-cell"
          {...(weapon && toHitT ? tipHandlers(toHitHover) : {})}
        >
          <div className="section-title">Hit</div>
          <div className="value">
            {weapon && toHitT ? (
              <span className="primary-number">{toHitT}+</span>
            ) : (
              <>
                —
                <span className="meta">
                  {weapon ? "missing" : "select a weapon"}
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="helper-cell"
          {...(weapon && woundT ? tipHandlers(woundHover) : {})}
        >
          <div className="section-title">Wound</div>
          <div className="value">
            {weapon && woundT ? (
              <span className="primary-number">{woundT}+</span>
            ) : (
              <>
                —
                <span className="meta">
                  {weapon ? "select a target" : "select a weapon & target"}
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="helper-cell"
          {...(weapon ? tipHandlers(defSaveHover) : {})}
        >
          <div className="section-title">Save</div>
          <div className="value">
            {weapon ? (
              <>
                <span className="primary-number">{bestLabel}</span>
              </>
            ) : (
              <>
                — <span className="meta">select a weapon</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="helper-cell" style={{ marginTop: 8 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            aria-label="Show expected results"
            checked={!!attackHelper?.showExpected}
            onChange={() => onToggleExpected?.()}
          />
          Show expected results
        </label>
        {weapon && attackHelper?.showExpected
          ? (() => {
              const attacksAvg =
                AParsed.kind === "fixed"
                  ? Number(AParsed.value || 0) * modelsInRange
                  : Number(AParsed.avg || 0) * modelsInRange;
              const pHit = toHitP ?? 0;
              const pWound = woundP ?? 0;
              const pSave = bestSv ? probabilityFromTarget(bestSv) || 0 : 0;
              const pFail = 1 - pSave;
              const dmgParsed = parseDiceNotation(weapon?.damage);
              const dmgAvg =
                dmgParsed.kind === "fixed"
                  ? Number(dmgParsed.value || 0)
                  : Number(dmgParsed.avg || 0);
              const expHits = attacksAvg * pHit;
              const expWounds = expHits * pWound;
              const expUnsaved = expWounds * pFail;
              const expDamage = expUnsaved * dmgAvg;
              return (
                <div
                  className="meta"
                  aria-label="Expected results"
                  style={{ marginTop: 6 }}
                >
                  Expected hits: {expHits.toFixed(1)} • Expected wounds:{" "}
                  {expWounds.toFixed(1)} • Expected unsaved:{" "}
                  {expUnsaved.toFixed(1)} • Expected damage:{" "}
                  {expDamage.toFixed(1)}
                </div>
              );
            })()
          : null}
      </div>
    </section>
  );
};

export default AttackHelperPanel;
