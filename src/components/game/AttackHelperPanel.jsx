import React from "react";
import {
  woundTarget,
  probabilityFromTarget,
  parseDiceNotation,
  computeDefenderSave,
  parseAp,
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
        ? "invulnerable"
        : "armor after AP"
      : "missing"
    : "select a target";

  let totalAttacks = null;
  if (AParsed.kind === "fixed")
    totalAttacks = Number(AParsed.value || 0) * modelsInRange;

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

      <div className="helper-grid">
        <div className="helper-cell">
          <div className="section-title">Attacks</div>
          <div className="value">
            {weapon ? (
              AParsed.kind === "fixed" ? (
                (totalAttacks ?? "—")
              ) : (
                `Roll ${AParsed.value}`
              )
            ) : (
              <>
                — <span className="meta">select a weapon</span>
              </>
            )}
          </div>
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

        <div className="helper-cell">
          <div className="section-title">To Hit</div>
          <div className="value">
            {weapon && toHitT ? (
              <>
                {toHitT}+
                <span className="meta">
                  {" "}
                  {toHitP != null ? `(p≈${(toHitP * 100).toFixed(1)}%)` : ""}
                </span>
              </>
            ) : (
              <>
                —{" "}
                <span className="meta">
                  {weapon ? "missing" : "select a weapon"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="helper-cell">
          <div className="section-title">To Wound</div>
          <div className="value">
            {weapon && woundT ? (
              <>
                {woundT}+
                <span className="meta">
                  {" "}
                  {woundP != null ? `(p≈${(woundP * 100).toFixed(1)}%)` : ""}
                </span>
              </>
            ) : (
              <>
                —{" "}
                <span className="meta">
                  {weapon ? "select a target" : "select a weapon & target"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="helper-cell">
          <div className="section-title">Defender Save</div>
          <div className="value">
            {bestLabel}
            <span className="meta"> {bestHint}</span>
          </div>
          {weapon ? (
            <div className="meta">
              Armour after AP:{" "}
              {breakdown.armourAfterAp ? `${breakdown.armourAfterAp}+` : "—"}
              {svResolved ? ` (SV ${svResolved}+)` : ""} AP {apInt || 0}
            </div>
          ) : null}
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
