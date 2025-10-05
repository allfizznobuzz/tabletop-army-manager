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
    fn?.();
  };

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const phaseRollCount = (phase) => {
    const rolls = last?.[phase]?.rolls;
    return Array.isArray(rolls) ? rolls.length : 0;
  };
  const runPhase = async (phase, fn) => {
    setToolbarMsg("");
    setRollingPhase(phase);
    fn?.();
    // Give parent time to set last
    await delay(120);
    let count = phaseRollCount(phase);
    // In slow mode, wait per die; otherwise, short fixed time
    const duration = slowMode
      ? Math.max(600, (count || 1) * slowSpeedMs + 200)
      : 800;
    if (!count && slowMode) setToolbarMsg(`${phase} – no dice to roll`);
    await delay(duration);
  };
  const rollAll = async () => {
    if (rollingAll) return;
    setRollingAll(true);
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
        .dice-results-card { margin-top: 12px; background: var(--bg-surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 10px); padding: 12px; }
        .dice-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .toggle { display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); margin-right: 8px; }
        .btn { border: 1px solid var(--line); background: var(--interactive-active); color: var(--text-primary); padding: 6px 10px; border-radius: 8px; cursor: pointer; }
        .btn:hover { background: var(--interactive-hover); }
        .btn.dramatic { background: color-mix(in srgb, var(--accent) 18%, var(--bg-surface)); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 20%, transparent); }
        .btn.clear { background: color-mix(in srgb, var(--danger) 12%, var(--bg-surface)); border-color: color-mix(in srgb, var(--danger) 40%, var(--line)); }
        .btn.small { padding: 4px 8px; font-size: 12px; }
        .btn.small.active { outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent); }
        .num { width: 56px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-surface); color: var(--text-primary); }
        .msg { color: var(--text-muted); font-size: 12px; margin-left: auto; }
        .phase { margin-top: 10px; }
        .phase-header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .phase-title { color: var(--text-primary); font-weight: 600; }
        .phase-sub { color: var(--text-muted); font-size: 12px; }
        .dice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(28px, 1fr)); gap: 6px; margin-top: 8px; }
        .die { width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; position: relative; box-shadow: 0 1px 0 rgba(0,0,0,0.08) inset, 0 2px 4px rgba(0,0,0,0.06); border: 1px solid var(--line); }
        .die.d6 { background: var(--bg-subtle); }
        .die.dN { background: var(--bg-subtle); color: var(--text-primary); font-weight: 600; font-size: 13px; }
        .die.hl { outline: 2px solid color-mix(in srgb, var(--action-success) 80%, transparent); }
        .die.rolling { animation: tilt 0.25s linear infinite; }
        @keyframes tilt { 0% { transform: rotate(0deg); } 50% { transform: rotate(7deg); } 100% { transform: rotate(0deg); } }
        .pips { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); width: 70%; height: 70%; }
        .pip { width: 6px; height: 6px; border-radius: 50%; background: var(--text-primary); box-shadow: 0 0 1px color-mix(in srgb, var(--text-primary) 40%, transparent); opacity: 0; }
        /* Visible pips per value (grid cells 1..9) */
        .pips.v1 .pip:nth-child(5),
        .pips.v3 .pip:nth-child(1), .pips.v3 .pip:nth-child(5), .pips.v3 .pip:nth-child(9),
        .pips.v5 .pip:nth-child(1), .pips.v5 .pip:nth-child(3), .pips.v5 .pip:nth-child(5), .pips.v5 .pip:nth-child(7), .pips.v5 .pip:nth-child(9) { opacity: 1; }
        .pips.v2 .pip:nth-child(1), .pips.v2 .pip:nth-child(9),
        .pips.v4 .pip:nth-child(1), .pips.v4 .pip:nth-child(3), .pips.v4 .pip:nth-child(7), .pips.v4 .pip:nth-child(9),
        .pips.v6 .pip:nth-child(1), .pips.v6 .pip:nth-child(3), .pips.v6 .pip:nth-child(4), .pips.v6 .pip:nth-child(6), .pips.v6 .pip:nth-child(7), .pips.v6 .pip:nth-child(9) { opacity: 1; }
      `}</style>

      <div className="dice-toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={shareRolls}
            onChange={(e) => setShareRolls?.(e.target.checked)}
          />
          Share to game log
        </label>
        <button className="btn" onClick={startRoll("attacks", onRollAttacks)}>
          Roll Attacks
        </button>
        <button className="btn" onClick={startRoll("hits", onRollHits)}>
          Roll Hits
        </button>
        <button className="btn" onClick={startRoll("wounds", onRollWounds)}>
          Roll Wounds
        </button>
        <button className="btn" onClick={startRoll("saves", onRollSaves)}>
          Roll Saves
        </button>
        <button className="btn" onClick={startRoll("damage", onRollDamage)}>
          Roll Damage
        </button>
        <button
          className="btn dramatic"
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
        <button className="btn clear" onClick={onClear}>
          Clear
        </button>
      </div>

      {/* Attacks */}
      {last?.attacks ? (
        <div className="phase">
          <div className="phase-header">
            <div className="phase-title">Attacks</div>
            <div className="phase-sub">
              {last.attacks.expr} → total {last.attacks.total}
            </div>
          </div>
          {Array.isArray(last.attacks.rolls) &&
          last.attacks.rolls.length > 0 ? (
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
              {last.hits.expr} → {last.hits.total} hits
            </div>
          </div>
          {Array.isArray(last.hits.rolls) && last.hits.rolls.length > 0 ? (
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
              {last.wounds.expr} → {last.wounds.total} wounds
            </div>
          </div>
          {Array.isArray(last.wounds.rolls) && last.wounds.rolls.length > 0 ? (
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
              {last.saves.expr} → saved {last.saves.total}, unsaved{" "}
              {last.saves.unsaved}
            </div>
          </div>
          {Array.isArray(last.saves.rolls) && last.saves.rolls.length > 0 ? (
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
              {last.damage.expr} → {last.damage.total} total
            </div>
          </div>
          {Array.isArray(last.damage.rolls) && last.damage.rolls.length > 0 ? (
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
