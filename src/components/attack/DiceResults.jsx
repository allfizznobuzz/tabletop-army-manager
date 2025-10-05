import React, { useState, useEffect, useMemo } from "react";

// Die face component: renders pips for d6, numbers for others
function Die({ value, sides = 6, state = "final", highlight = false }) {
  const isD6 = sides === 6;
  return (
    <div
      className={`die ${state} ${highlight ? "hl" : ""} ${isD6 ? "d6" : "dN"}`}
      aria-label={`d${sides} = ${value}`}
      title={`d${sides} = ${value}`}
    >
      {isD6 ? (
        <div className={`pips v${value}`}>
          {/* 3x3 grid pips (1..9) */}
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
          <span className="pip" />
        </div>
      ) : (
        <span className="num">{value}</span>
      )}
    </div>
  );
}

export default function DiceResults({
  last,
  shareRolls,
  setShareRolls,
  mods,
  onChangeMods,
  onRollAttacks,
  onRollHits,
  onRollWounds,
  onRollSaves,
  onRollDamage,
  onClear,
}) {
  const [rollingPhase, setRollingPhase] = useState(null);
  const [slowMode, setSlowMode] = useState(false);

  // derive sides per phase
  const sides = useMemo(
    () => ({
      attacks: last?.attacks?.sides || 6,
      hits: 6,
      wounds: 6,
      saves: 6,
      damage: last?.damage?.sides || 6,
    }),
    [last?.attacks?.sides, last?.damage?.sides],
  );

  // rolling animation: swap values with random faces periodically
  const [tick, setTick] = useState(0);
  const [revealCount, setRevealCount] = useState(0);
  const [slowSpeedMs, setSlowSpeedMs] = useState(1500); // per-die reveal time (default 1.5s)
  const [rollingAll, setRollingAll] = useState(false);
  const [toolbarMsg, setToolbarMsg] = useState("");
  const [expandedPhase, setExpandedPhase] = useState(null);
  useEffect(() => {
    if (!rollingPhase) return;
    if (!slowMode) {
      // Quick group animation
      const id = setInterval(() => setTick((t) => t + 1), 80);
      const stop = setTimeout(() => {
        clearInterval(id);
        setRollingPhase(null);
      }, 700);
      return () => {
        clearInterval(id);
        clearTimeout(stop);
      };
    }
    // Slow mode: reveal one die at a time for the active phase
    setRevealCount(0);
    const phaseRolls = last?.[rollingPhase]?.rolls || [];
    if (phaseRolls.length === 0) {
      setRollingPhase(null);
      return;
    }
    const stepMs = slowSpeedMs; // time per die reveal
    // Keep flicker reasonably active regardless of stepMs
    const flickerMs = 100;
    const tickId = setInterval(() => setTick((t) => t + 1), flickerMs);
    const stepId = setInterval(() => {
      setRevealCount((c) => {
        const n = c + 1;
        if (n >= phaseRolls.length) {
          clearInterval(stepId);
          clearInterval(tickId);
          setRollingPhase(null);
        }
        return n;
      });
    }, stepMs);
    return () => {
      clearInterval(stepId);
      clearInterval(tickId);
    };
  }, [rollingPhase, slowMode, slowSpeedMs, last]);

  const rand = (n) => Math.max(1, Math.ceil(Math.random() * n));
  const displayRolls = (phase, rolls) => {
    if (!Array.isArray(rolls)) return [];
    if (rollingPhase === phase) {
      if (slowMode)
        return rolls.map((v, i) =>
          i < revealCount ? v : rand(sides[phase] || 6),
        );
      return rolls.map(() => rand(sides[phase] || 6));
    }
    return rolls;
  };

  const dieState = (phase, index) => {
    if (rollingPhase !== phase) return "final";
    if (!slowMode) return "rolling";
    return index < revealCount ? "final" : "rolling";
  };

  const startRoll = (phase, fn) => () => {
    setRollingPhase(phase);
    setExpandedPhase(phase);
    fn?.();
  };

  const rolling = (phase) => rollingPhase === phase;

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const phaseRollCount = (phase) => {
    const rolls = last?.[phase]?.rolls;
    return Array.isArray(rolls) ? rolls.length : 0;
  };
  const runPhase = async (phase, fn) => {
    setToolbarMsg("");
    setRollingPhase(phase);
    if (!rollingAll) setExpandedPhase(phase);
    fn?.();
    // Give parent time to set last
    await delay(120);
    let count = phaseRollCount(phase);
    // In slow mode, wait per die; otherwise, short fixed time
    const duration = slowMode
      ? Math.max(600, (count || 1) * slowSpeedMs + 200)
      : 800;
    if (!count) setToolbarMsg(`${phase} – no dice to roll`);
    await delay(duration);
  };
  const rollAll = async () => {
    if (rollingAll) return;
    setRollingAll(true);
    setExpandedPhase("attacks");
    try {
      await runPhase("attacks", onRollAttacks);
      await runPhase("hits", onRollHits);
      await runPhase("wounds", onRollWounds);
      await runPhase("saves", onRollSaves);
      await runPhase("damage", onRollDamage);
    } finally {
      setRollingAll(false);
      setRollingPhase(null);
      // brief status clear later
      setTimeout(() => setToolbarMsg(""), 1500);
    }
  };

  return (
    <div className="dice-results-card">
      <style>{`
        .dice-results-card { margin-top: 10px; background: var(--bg-surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 10px); padding: 10px; }
        .dice-toolbar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .toggle { display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); margin-right: 8px; }
        .btn { border: 1px solid var(--line); background: var(--interactive-active); color: var(--text-primary); padding: 6px 10px; border-radius: 8px; cursor: pointer; }
        .btn:hover { background: var(--interactive-hover); }
        .btn.dramatic { background: color-mix(in srgb, var(--accent) 18%, var(--bg-surface)); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 20%, transparent); }
        .btn.clear { background: color-mix(in srgb, var(--danger) 12%, var(--bg-surface)); border-color: color-mix(in srgb, var(--danger) 40%, var(--line)); }
        .btn.small { padding: 4px 8px; font-size: 12px; }
        .btn.small.active { outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent); }
        .num { width: 56px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-surface); color: var(--text-primary); }
        .msg { color: var(--text-muted); font-size: 12px; margin-left: auto; }
        .summary-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0 2px; }
        .phase { margin-top: 8px; }
        .phase-header { display: flex; align-items: center; justify-content: flex-start; gap: 10px; }
        .phase-title { color: var(--text-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; order: 0; }
        .phase-sub { color: var(--text-muted); font-size: 12px; display: flex; gap: 6px; align-items: center; order: 2; }
        .phase-actions { order: 1; margin: 0 6px 0 0; }
        .phase:has(.die.rolling) .phase-sub .chip { display: none; }
        .chip { background: var(--interactive-hover); color: var(--text-secondary); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; font-size: 12px; }
        .dice-grid { display: grid; grid-template-columns: repeat(auto-fit, 24px); justify-content: start; gap: 4px; margin-top: 6px; }
        .die { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; position: relative; box-shadow: 0 1px 0 rgba(0,0,0,0.08) inset, 0 2px 4px rgba(0,0,0,0.06); border: 1px solid var(--line); }
        .die.d6 { background: var(--bg-subtle); }
        .die.dN { background: var(--bg-subtle); color: var(--text-primary); font-weight: 600; font-size: 13px; }
        .die.hl { outline: 2px solid color-mix(in srgb, var(--action-success) 80%, transparent); }
        .die.rolling { animation: tilt 0.25s linear infinite; }
        @keyframes tilt { 0% { transform: rotate(0deg); } 50% { transform: rotate(7deg); } 100% { transform: rotate(0deg); } }
        .pips { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); width: 70%; height: 70%; }
        .pip { width: 5px; height: 5px; border-radius: 50%; background: var(--text-primary); box-shadow: 0 0 1px color-mix(in srgb, var(--text-primary) 40%, transparent); opacity: 0; }
        /* Visible pips per value (grid cells 1..9) */
        .pips.v1 .pip:nth-child(5),
        .pips.v3 .pip:nth-child(1), .pips.v3 .pip:nth-child(5), .pips.v3 .pip:nth-child(9),
        .pips.v5 .pip:nth-child(1), .pips.v5 .pip:nth-child(3), .pips.v5 .pip:nth-child(5), .pips.v5 .pip:nth-child(7), .pips.v5 .pip:nth-child(9) { opacity: 1; }
        .pips.v2 .pip:nth-child(1), .pips.v2 .pip:nth-child(9),
        .pips.v4 .pip:nth-child(1), .pips.v4 .pip:nth-child(3), .pips.v4 .pip:nth-child(7), .pips.v4 .pip:nth-child(9),
        .pips.v6 .pip:nth-child(1), .pips.v6 .pip:nth-child(3), .pips.v6 .pip:nth-child(4), .pips.v6 .pip:nth-child(6), .pips.v6 .pip:nth-child(7), .pips.v6 .pip:nth-child(9) { opacity: 1; }
      `}</style>

      <div className="dice-toolbar">
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={startRoll("attacks", onRollAttacks)}
        >
          Roll Attacks
        </button>
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={startRoll("hits", onRollHits)}
        >
          Roll Hits
        </button>
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={startRoll("wounds", onRollWounds)}
        >
          Roll Wounds
        </button>
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={startRoll("saves", onRollSaves)}
        >
          Roll Saves
        </button>
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={startRoll("damage", onRollDamage)}
        >
          Roll Damage
        </button>
        <button
          className="btn dramatic"
          disabled={rollingAll}
          onClick={() => setSlowMode((v) => !v)}
          title="Toggle slow roll"
        >
          {slowMode ? "Slow Roll: On" : "Slow Roll: Off"}
        </button>
        {slowMode ? (
          <span className="toggle" aria-label="Slow roll speed">
            Speed:
            <button
              className={`btn small ${slowSpeedMs === 800 ? "active" : ""}`}
              onClick={() => setSlowSpeedMs(800)}
            >
              0.8s
            </button>
            <button
              className={`btn small ${slowSpeedMs === 1500 ? "active" : ""}`}
              onClick={() => setSlowSpeedMs(1500)}
            >
              1.5s
            </button>
            <button
              className={`btn small ${slowSpeedMs === 2500 ? "active" : ""}`}
              onClick={() => setSlowSpeedMs(2500)}
            >
              2.5s
            </button>
            <button
              className={`btn small ${slowSpeedMs === 4000 ? "active" : ""}`}
              onClick={() => setSlowSpeedMs(4000)}
            >
              4.0s
            </button>
          </span>
        ) : null}
        <button
          className="btn dramatic"
          disabled={rollingAll}
          onClick={rollAll}
          title="Roll all phases sequentially"
        >
          Roll All
        </button>
        <span className="toggle" aria-label="Dice modifiers">
          Modifiers:
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!(mods && mods.lethal)}
              onChange={(e) =>
                onChangeMods?.({ ...(mods || {}), lethal: e.target.checked })
              }
            />
            Lethal hits
          </label>
          <label className="toggle">
            Sustained X:
            <input
              className="num"
              type="number"
              min={0}
              max={6}
              step={1}
              value={Number(mods?.sustained || 0)}
              onChange={(e) => {
                const val = Math.max(
                  0,
                  Math.min(6, Number(e.target.value) || 0),
                );
                onChangeMods?.({ ...(mods || {}), sustained: val });
              }}
            />
          </label>
        </span>
        <button className="btn clear" disabled={rollingAll} onClick={onClear}>
          Clear
        </button>
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={() => setExpandedPhase("all")}
        >
          Expand All
        </button>
        <button
          className="btn small"
          disabled={rollingAll}
          onClick={() => setExpandedPhase(null)}
        >
          Collapse All
        </button>
        <div className="spacer" style={{ flex: 1 }} />
        <label className="toggle">
          <input
            type="checkbox"
            checked={shareRolls}
            onChange={(e) => setShareRolls?.(e.target.checked)}
          />
          Share to game log
        </label>
        {toolbarMsg ? <span className="msg">{toolbarMsg}</span> : null}
      </div>

      {last?.attacks ||
      last?.hits ||
      last?.wounds ||
      last?.saves ||
      last?.damage ? (
        <div className="summary-row">
          {last?.attacks ? (
            <span
              className="chip"
              role="button"
              onClick={() =>
                setExpandedPhase(expandedPhase === "attacks" ? null : "attacks")
              }
              title="Toggle Attacks"
            >
              A: {rolling("attacks") ? "—" : last.attacks.total}
            </span>
          ) : null}
          {last?.hits ? (
            <span
              className="chip"
              role="button"
              onClick={() =>
                setExpandedPhase(expandedPhase === "hits" ? null : "hits")
              }
              title="Toggle Hits"
            >
              H: {rolling("hits") ? "—" : last.hits.total}
            </span>
          ) : null}
          {last?.wounds ? (
            <span
              className="chip"
              role="button"
              onClick={() =>
                setExpandedPhase(expandedPhase === "wounds" ? null : "wounds")
              }
              title="Toggle Wounds"
            >
              W: {rolling("wounds") ? "—" : last.wounds.total}
            </span>
          ) : null}
          {last?.saves ? (
            <span
              className="chip"
              role="button"
              onClick={() =>
                setExpandedPhase(expandedPhase === "saves" ? null : "saves")
              }
              title="Toggle Saves"
            >
              S: {rolling("saves") ? "—" : last.saves.total}/{rolling("saves") ? "—" : last.saves.unsaved}
            </span>
          ) : null}
          {last?.damage ? (
            <span
              className="chip"
              role="button"
              onClick={() =>
                setExpandedPhase(expandedPhase === "damage" ? null : "damage")
              }
              title="Toggle Damage"
            >
              Dmg: {rolling("damage") ? "—" : last.damage.total}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Attacks */}
      {last?.attacks ? (
        <div className="phase">
          <div className="phase-header">
            <div className="phase-title">Attacks</div>
            <div className="phase-sub">
              <span className="chip">{last.attacks.expr}</span>
              <span className="chip">Total {last.attacks.total}</span>
            </div>
            <div className="phase-actions">
              <button
                className="btn small"
                onClick={() =>
                  setExpandedPhase(
                    expandedPhase === "attacks" ? null : "attacks",
                  )
                }
              >
                {expandedPhase === "attacks" || expandedPhase === "all"
                  ? "▾"
                  : "▸"}
              </button>
            </div>
          </div>
          {Array.isArray(last.attacks.rolls) &&
          last.attacks.rolls.length > 0 &&
          (expandedPhase === "attacks" ||
            expandedPhase === "all" ||
            rollingPhase === "attacks") ? (
            <div className="dice-grid">
              {displayRolls("attacks", last.attacks.rolls).map((v, i) => (
                <Die
                  key={`atk_${i}`}
                  value={v}
                  sides={sides.attacks}
                  state={dieState("attacks", i)}
                />
              ))}
            </div>
          ) : (
            <div className="phase-sub">Fixed attacks (no dice rolled)</div>
          )}
        </div>
      ) : null}

      {/* Hits */}
      {last?.hits ? (
        <div className="phase">
          <div className="phase-header">
            <div className="phase-title">Hits</div>
            <div className="phase-sub">
              <span className="chip">{last.hits.expr}</span>
              <span className="chip">{last.hits.total} hits</span>
              {Number.isFinite(last.hits.crits) ? (
                <span className="chip">crit {last.hits.crits}</span>
              ) : null}
              {Number(last.hits.sustained) > 0 ? (
                <span className="chip">
                  +Sust {last.hits.crits * Number(last.hits.sustained || 0)}
                </span>
              ) : null}
              {Number.isFinite(last.hits.autoWounds) &&
              last.hits.autoWounds > 0 ? (
                <span className="chip">auto-W {last.hits.autoWounds}</span>
              ) : null}
            </div>
            <div className="phase-actions">
              <button
                className="btn small"
                onClick={() =>
                  setExpandedPhase(expandedPhase === "hits" ? null : "hits")
                }
              >
                {expandedPhase === "hits" || expandedPhase === "all"
                  ? "▾"
                  : "▸"}
              </button>
            </div>
          </div>
          {Array.isArray(last.hits.rolls) &&
          last.hits.rolls.length > 0 &&
          (expandedPhase === "hits" ||
            expandedPhase === "all" ||
            rollingPhase === "hits") ? (
            <div className="dice-grid">
              {displayRolls("hits", last.hits.rolls).map((v, i) => (
                <Die
                  key={`hit_${i}`}
                  value={v}
                  sides={6}
                  state={dieState("hits", i)}
                  highlight={
                    dieState("hits", i) === "final" &&
                    v >= (last.hits.threshold || 7)
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Wounds */}
      {last?.wounds ? (
        <div className="phase">
          <div className="phase-header">
            <div className="phase-title">Wounds</div>
            <div className="phase-sub">
              <span className="chip">{last.wounds.expr}</span>
              <span className="chip">{last.wounds.total} wounds</span>
              {Number.isFinite(last.wounds.rolled) ? (
                <span className="chip">rolled {last.wounds.rolled}</span>
              ) : null}
              {Number.isFinite(last.wounds.autoFromLethal) &&
              last.wounds.autoFromLethal > 0 ? (
                <span className="chip">
                  lethal +{last.wounds.autoFromLethal}
                </span>
              ) : null}
            </div>
            <div className="phase-actions">
              <button
                className="btn small"
                onClick={() =>
                  setExpandedPhase(expandedPhase === "wounds" ? null : "wounds")
                }
              >
                {expandedPhase === "wounds" || expandedPhase === "all"
                  ? "▾"
                  : "▸"}
              </button>
            </div>
          </div>
          {Array.isArray(last.wounds.rolls) &&
          last.wounds.rolls.length > 0 &&
          (expandedPhase === "wounds" ||
            expandedPhase === "all" ||
            rollingPhase === "wounds") ? (
            <div className="dice-grid">
              {displayRolls("wounds", last.wounds.rolls).map((v, i) => (
                <Die
                  key={`wnd_${i}`}
                  value={v}
                  sides={6}
                  state={dieState("wounds", i)}
                  highlight={
                    dieState("wounds", i) === "final" &&
                    v >= (last.wounds.threshold || 7)
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Saves */}
      {last?.saves ? (
        <div className="phase">
          <div className="phase-header">
            <div className="phase-title">Saves</div>
            <div className="phase-sub">
              <span className="chip">{last.saves.expr}</span>
              <span className="chip">saved {last.saves.total}</span>
              <span className="chip">unsaved {last.saves.unsaved}</span>
            </div>
            <div className="phase-actions">
              <button
                className="btn small"
                onClick={() =>
                  setExpandedPhase(expandedPhase === "saves" ? null : "saves")
                }
              >
                {expandedPhase === "saves" || expandedPhase === "all"
                  ? "▾"
                  : "▸"}
              </button>
            </div>
          </div>
          {Array.isArray(last.saves.rolls) &&
          last.saves.rolls.length > 0 &&
          (expandedPhase === "saves" ||
            expandedPhase === "all" ||
            rollingPhase === "saves") ? (
            <div className="dice-grid">
              {displayRolls("saves", last.saves.rolls).map((v, i) => (
                <Die
                  key={`sv_${i}`}
                  value={v}
                  sides={6}
                  state={dieState("saves", i)}
                  highlight={
                    dieState("saves", i) === "final" &&
                    v >= (last.saves.threshold || 7)
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Damage */}
      {last?.damage ? (
        <div className="phase">
          <div className="phase-header">
            <div className="phase-title">Damage</div>
            <div className="phase-sub">
              <span className="chip">{last.damage.expr}</span>
              <span className="chip">total {last.damage.total}</span>
            </div>
            <div className="phase-actions">
              <button
                className="btn small"
                onClick={() =>
                  setExpandedPhase(expandedPhase === "damage" ? null : "damage")
                }
              >
                {expandedPhase === "damage" || expandedPhase === "all"
                  ? "▾"
                  : "▸"}
              </button>
            </div>
          </div>
          {Array.isArray(last.damage.rolls) &&
          last.damage.rolls.length > 0 &&
          (expandedPhase === "damage" ||
            expandedPhase === "all" ||
            rollingPhase === "damage") ? (
            <div className="dice-grid">
              {displayRolls("damage", last.damage.rolls).map((v, i) => (
                <Die
                  key={`dmg_${i}`}
                  value={v}
                  sides={sides.damage}
                  state={dieState("damage", i)}
                />
              ))}
            </div>
          ) : (
            <div className="phase-sub">Fixed damage (no dice rolled)</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
