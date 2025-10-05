import React, { useEffect, useMemo, useState } from "react";
import { rollExpression } from "utils/dice";
import { addGameUpdate, subscribeToGameUpdates } from "../../firebase/database";

export default function DiceTray({ gameId, user, onClose, offline = false }) {
  const [expr, setExpr] = useState("10d6");
  const [seed, setSeed] = useState("");
  const [share, setShare] = useState(true);
  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(`dice_hist_${gameId}`);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });
  const [sharedLog, setSharedLog] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(`dice_hist_${gameId}`, JSON.stringify(history));
    } catch (_) {}
  }, [gameId, history]);

  // Optional subscription to the game's shared updates (dice only)
  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeToGameUpdates(gameId, (updates) => {
      const dice = (updates || []).filter((u) => u.type === "dice");
      // Show latest first
      setSharedLog(dice);
    });
    return () => unsub && unsub();
  }, [gameId]);

  const quicks = useMemo(
    () => ["D6", "2D6", "10D6", "D3", "D20"].map((q) => q.toLowerCase()),
    [],
  );

  const normalizeQuick = (q) => {
    const m = q.match(/^(\d+)?d(\d+)$/i);
    if (!m) return "1d6";
    const c = m[1] ? parseInt(m[1], 10) : 1;
    const s = parseInt(m[2], 10);
    return `${c}d${s}`;
  };

  const onQuick = (q) => setExpr(normalizeQuick(q));

  const onRoll = async () => {
    const res = rollExpression(expr, { seed: seed || undefined });
    setHistory((prev) =>
      [{ ...res, id: `loc_${res.timestamp}` }, ...prev].slice(0, 100),
    );
    if (share && gameId && user?.uid) {
      try {
        await addGameUpdate(gameId, {
          type: "dice",
          expr: res.expr,
          count: res.count,
          sides: res.sides,
          modifier: res.modifier,
          rolls: res.rolls,
          total: res.total,
          seed: res.seed,
          playerId: user.uid,
          playerName: user.displayName || user.email || "Player",
        });
      } catch (e) {
        // Keep local history even if network fails (will not block UI)
        console.warn("Failed to persist dice update", e);
      }
    }
  };

  return (
    <div className="dice-overlay" role="dialog" aria-label="Dice Tray">
      <div className="dice-modal">
        <div className="dice-header">
          <h3>Dice Tray</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="dice-controls">
          <div className="field">
            <label>Expression</label>
            <input
              type="text"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="e.g., 10d6+2"
            />
          </div>
          <div className="field">
            <label>Seed (optional)</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="leave blank for random"
            />
          </div>
          <div className="field row">
            {quicks.map((q) => (
              <button key={q} className="pill" onClick={() => onQuick(q)}>
                {q.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="actions">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={share}
                onChange={(e) => setShare(e.target.checked)}
              />
              Share to game log
            </label>
            <button className="roll-btn" onClick={onRoll}>
              Roll
            </button>
          </div>
        </div>

        <div className="dice-panels">
          <section className="panel">
            <h4>My Recent Rolls</h4>
            <ul className="rolls">
              {history.length === 0 ? (
                <li className="muted">No rolls yet</li>
              ) : (
                history.map((r) => (
                  <li key={r.id}>
                    <code>{r.expr}</code> → <strong>{r.total}</strong>{" "}
                    <span className="muted">[{r.rolls.join(", ")}]</span>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="panel">
            <h4>Shared Game Log</h4>
            <ul className="rolls">
              {sharedLog.length === 0 ? (
                <li className="muted">No shared rolls yet</li>
              ) : (
                sharedLog.map((u) => (
                  <li key={u.id}>
                    <span className="muted">{u.playerName || u.playerId}:</span>{" "}
                    <code>{u.expr || `${u.count}d${u.sides}`}</code> →{" "}
                    <strong>{u.total}</strong>{" "}
                    {Array.isArray(u.rolls) && (
                      <span className="muted">[{u.rolls.join(", ")}]</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
      <style jsx>{`
        .dice-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .dice-modal {
          background: var(--bg, #111826);
          color: var(--fg, #fff);
          width: min(720px, 92vw);
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }
        .dice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 20px;
          cursor: pointer;
        }
        .dice-controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field.row {
          grid-column: 1 / -1;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        input[type="text"] {
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid #334155;
          background: #0b1220;
          color: #f1f5f9;
        }
        .pill {
          background: #1e293b;
          border: 1px solid #334155;
          color: #e2e8f0;
          border-radius: 999px;
          padding: 6px 12px;
          cursor: pointer;
        }
        .actions {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .roll-btn {
          background: var(--action-primary, #10b981);
          border: none;
          color: #020617;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .dice-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }
        .panel {
          background: #0b1220;
          border: 1px solid #1f2937;
          border-radius: 8px;
          padding: 12px;
        }
        .rolls {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .muted {
          color: #94a3b8;
        }
        @media (max-width: 640px) {
          .dice-controls {
            grid-template-columns: 1fr;
          }
          .dice-panels {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
