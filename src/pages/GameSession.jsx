import React, { useState, useEffect, useMemo, useRef } from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { updateGameState, subscribeToGame } from "../firebase/database";
// AuthContext will be implemented later
import ArmyColumn from "components/army/ArmyColumn";
import {
  canAttach,
  isLeaderUnit as inferIsLeaderUnit,
  sourceCanAttach as strictSourceCanAttach,
} from "utils/eligibility";
// Army import handled via hook
import useGameSubscription from "hooks/useGameSubscription";
import useMedia from "hooks/useMedia";
import useStickyHeaderHeight from "hooks/useStickyHeaderHeight";
import useUnitsSnapshot from "hooks/useUnitsSnapshot";
import useColumnSync from "hooks/useColumnSync";
import useCompareUnits from "hooks/useCompareUnits";
import useAttackHelper from "hooks/useAttackHelper";
import useArmyImport from "hooks/useArmyImport";
import GameHeader from "components/session/GameHeader";
import ArmySidebar from "components/army/ArmySidebar";
import DatasheetRail from "components/datasheet/DatasheetRail";
import DatasheetCompare from "components/datasheet/DatasheetCompare";
import DatasheetOverlay from "components/datasheet/DatasheetOverlay";
// Removed DiceTray (dice button disabled)

// ArmyColumn renders one player's army column with fully-contained DnD and attach logic.
// It persists state to gameState.columns.<col>.{attachments,unitOrder} and never crosses columns.

// Attached unit sortable is implemented inside ./ArmyColumn

const GameSessionView = ({
  gameId,
  user,
  gameData: gameDataProp,
  offline,
  onGameMeta,
}) => {
  // When offline, don't subscribe to Firestore to avoid slow WebChannel backoff
  const subscribeFn = offline ? undefined : subscribeToGame;
  const subscribedGameData = useGameSubscription(gameId, subscribeFn);
  // Offline overlay: allow local import when Firestore is unreachable
  const [localGame, setLocalGame] = useState(null);
  // Prefer local overlay, then explicit prop, then subscription
  const gameData = localGame ?? gameDataProp ?? subscribedGameData;
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isNarrow = useMedia("(max-width: 768px)", false);
  const [draggedUnit, setDraggedUnit] = useState(null);

  // Keep sticky header height synced via hook
  useStickyHeaderHeight(".army-column .column-header", "--army-header-offset");
  const [pulseTargetId, setPulseTargetId] = useState(null);
  const {
    attachmentsA,
    setAttachmentsA,
    attachmentsB,
    setAttachmentsB,
    unitOrderA,
    setUnitOrderA,
    unitOrderB,
    setUnitOrderB,
  } = useColumnSync(gameData);
  const [leadershipOverrides, setLeadershipOverrides] = useState({});
  const pointerRef = useRef({ x: 0, y: 0, has: false });
  const scrollRafRef = useRef(null);
  const draggingRef = useRef(false);
  const {
    inputARef,
    inputBRef,
    uploadErrorA,
    uploadErrorB,
    onFileInputChange,
    onDragOverZone,
    onDropZone,
  } = useArmyImport(gameId);
  // Keep last-clicked unit per column pinned so both datasheets can display
  const [pinnedUnitIdA, setPinnedUnitIdA] = useState(null);
  const [pinnedUnitIdB, setPinnedUnitIdB] = useState(null);

  const pinUnit = (u) => {
    if (!u) return;
    if (u.column === "A") setPinnedUnitIdA(u.id);
    else if (u.column === "B") setPinnedUnitIdB(u.id);
  };

  // Listen for localArmyImport events from importer when DB update fails
  useEffect(() => {
    const handler = (e) => {
      try {
        const { columnKey, armyData } = e.detail || {};
        if (!columnKey || !armyData) return;
        const baseKey = columnKey === "A" ? "playerA" : "playerB";
        setLocalGame((prev) => {
          const base = prev ?? subscribedGameData ?? {};
          const existingBase = base[baseKey] || {};
          const nextUnitOrder = (armyData.units || []).map(
            (_, i) => `${columnKey}_unit_${i}`,
          );
          return {
            ...base,
            [baseKey]: { ...existingBase, armyData },
            gameState: {
              ...(base.gameState || {}),
              columns: {
                ...(base.gameState?.columns || {}),
                [columnKey]: {
                  attachments: {},
                  unitOrder: nextUnitOrder,
                },
              },
            },
          };
        });
      } catch (_) {}
    };
    window.addEventListener("localArmyImport", handler);
    return () => window.removeEventListener("localArmyImport", handler);
  }, [subscribedGameData]);

  // Manual attach from datasheet: attach childId under leaderId, update state and persist
  const attachUnitToLeader = (leaderId, childId) => {
    const leader = allUnitsById[leaderId];
    const child = allUnitsById[childId];
    if (!leader || !child) return;
    if (leader.column !== child.column) return; // never cross columns
    const col = leader.column;
    const isA = col === "A";
    const attachments = isA ? attachmentsA : attachmentsB;
    const setAttachments = isA ? setAttachmentsA : setAttachmentsB;
    const unitOrder = isA ? unitOrderA : unitOrderB;
    const setUnitOrder = isA ? setUnitOrderA : setUnitOrderB;

    const next = { ...(attachments || {}) };
    // Remove child from any existing groups
    Object.keys(next).forEach((lid) => {
      next[lid] = (next[lid] || []).filter((id) => id !== childId);
      if ((next[lid] || []).length === 0) delete next[lid];
    });
    const arr = next[leaderId] || [];
    if (!arr.includes(childId)) arr.push(childId);
    next[leaderId] = arr;
    setAttachments(next);

    const newTop = (unitOrder || []).filter((id) => id !== childId);
    setUnitOrder(newTop);

    if (!offline) {
      const base = `gameState.columns.${col}`;
      updateGameState(gameId, {
        [`${base}.attachments`]: next,
        [`${base}.unitOrder`]: newTop,
      }).catch((err) =>
        console.error("persist attach (datasheet) failed", err),
      );
    }
  };

  // gameData provided by useGameSubscription

  // isNarrow provided by useMedia

  // Close overlay when deselecting or when exiting narrow mode
  useEffect(() => {
    if (!isNarrow) setOverlayOpen(false);
    if (!selectedUnit) setOverlayOpen(false);
  }, [isNarrow, selectedUnit]);

  // Build full units list (snapshot from gameData)
  const { allUnitsA, allUnitsB, allUnits, allUnitsById } =
    useUnitsSnapshot(gameData);

  // Resolve attacker/defender for compare view
  const { leftUnit, rightUnit, targetUnit } = useCompareUnits(
    selectedUnit,
    pinnedUnitIdA,
    pinnedUnitIdB,
    allUnitsById,
  );

  // Compute merged keywords for a unit based on current attachments
  const withMergedKeywords = useMemo(() => {
    const build = (u) => {
      if (!u) return u;
      const attachments = u.column === "A" ? attachmentsA : attachmentsB;
      const merged = new Set((u.keywords || []).map((k) => String(k)));
      // If leader: include all children keywords
      const childIds = attachments?.[u.id] || [];
      childIds.forEach((cid) => {
        (allUnitsById[cid]?.keywords || []).forEach((k) =>
          merged.add(String(k)),
        );
      });
      // If attached: include leader keywords
      const leaderId = Object.keys(attachments || {}).find((lid) =>
        (attachments[lid] || []).includes(u.id),
      );
      if (leaderId) {
        (allUnitsById[leaderId]?.keywords || []).forEach((k) =>
          merged.add(String(k)),
        );
      }
      return { ...u, keywords: Array.from(merged) };
    };
    return {
      left: build(leftUnit),
      right: build(rightUnit),
      target: build(targetUnit),
      selected: build(selectedUnit),
    };
  }, [
    leftUnit,
    rightUnit,
    targetUnit,
    selectedUnit,
    attachmentsA,
    attachmentsB,
    allUnitsById,
  ]);

  // Centralize Attack Helper state and handlers
  const {
    attackHelper,
    setAttackHelper,
    onToggleWeaponLeft,
    onToggleWeaponRight,
    onChangeModelsInRange,
    onToggleExpected,
    close: closeAttackHelper,
  } = useAttackHelper({
    leftUnit,
    rightUnit,
    pinnedUnitIdA,
    pinnedUnitIdB,
    setPinnedUnitIdA,
    setPinnedUnitIdB,
    allUnitsById,
    setSelectedUnit,
  });

  // Per-column ordering is managed inside ArmyColumn

  // Placeholder approach needs no visual order effect

  // Per-column state synced via hook

  // dnd-kit sensors and handlers
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
  );

  // sensors are reused in per-column DnD

  // Sync leadership overrides from backend
  useEffect(() => {
    const backend = gameData?.gameState?.leadershipOverrides || {};
    setLeadershipOverrides(backend);
  }, [gameData?.gameState?.leadershipOverrides]);

  // Per-column detach handled inside ArmyColumn

  // Update overrides for a unit and persist
  const updateUnitOverrides = (unitId, partial) => {
    setLeadershipOverrides((prev) => {
      const next = { ...(prev || {}) };
      const current = next[unitId] || {
        canLead: "auto",
        canBeLed: "auto",
        allowList: [],
      };
      const merged = {
        ...current,
        ...partial,
        allowList:
          partial.allowList !== undefined
            ? Array.from(new Set(partial.allowList))
            : current.allowList,
      };
      next[unitId] = merged;
      if (!offline) {
        updateGameState(gameId, {
          "gameState.leadershipOverrides": next,
        }).catch((err) => console.error("persist overrides failed", err));
      }
      return next;
    });
  };

  // Helper functions for new unit status system
  const getUnitStatusClass = (unit) => {
    if (unit.currentWounds === 0) return "dead";
    if (unit.hasActed) return "done"; // Assuming we'll add this field
    return "ready";
  };

  // Quick leader check for visuals (orange glow)
  const isLeaderUnitVisual = (unit) =>
    inferIsLeaderUnit(unit, leadershipOverrides);

  // Attach eligibility: pairwise allow OR explicit source data rules via strictSourceCanAttach
  const canLeaderAttachToUnit = (leader, unit) => {
    if (!leader || !unit) return false;
    if (leader.column !== unit.column) return false; // never cross columns
    return canAttach(leader, unit, leadershipOverrides, strictSourceCanAttach);
  };

  // File import/drag-drop handled via useArmyImport(gameId)

  // Determine whose turn it is
  const isMyTurn = gameData?.currentTurn === user?.uid || false;

  // Push game meta to top nav
  useEffect(() => {
    if (!onGameMeta) return;
    if (!gameData) {
      onGameMeta(null);
      return;
    }
    const meta = { id: gameId, round: gameData?.round };
    const ct = gameData?.currentTurn;
    const players = Array.isArray(gameData?.players) ? gameData.players : [];
    const playerArmies = gameData?.playerArmies || {};
    let turnName = null;
    if (typeof ct === "number" && players[ct]) {
      const uid = players[ct];
      turnName = playerArmies[uid]?.playerName || `Player ${ct + 1}`;
      meta.currentTurn = ct;
    } else if (typeof ct === "string") {
      turnName = playerArmies[ct]?.playerName || ct;
      meta.currentTurn = ct;
    }
    meta.turnName = turnName;
    onGameMeta(meta);
    return () => onGameMeta && onGameMeta(null);
  }, [onGameMeta, gameData, gameId]);

  // Support both new playerA/B schema and legacy playerArmies map
  const hasArmyFor = (col) => {
    const direct =
      col === "A" ? gameData?.playerA?.armyData : gameData?.playerB?.armyData;
    if (direct) return true;
    const playerArmies = gameData?.playerArmies || {};
    const players = Array.isArray(gameData?.players) ? gameData.players : [];
    let uid = col === "A" ? players[0] : players[1];
    if (!uid) {
      const keys = Object.keys(playerArmies);
      uid = col === "A" ? keys[0] : keys[1];
    }
    const pa = uid ? playerArmies[uid] : null;
    return !!pa?.armyData;
  };
  const hasArmyA = hasArmyFor("A");
  const hasArmyB = hasArmyFor("B");

  return (
    <div className="game-session">
      <GameHeader
        name={gameData?.name}
        round={gameData?.round}
        isMyTurn={isMyTurn}
        gameId={gameId}
        isNarrow={isNarrow}
        hasSelectedUnit={!!selectedUnit}
        onOpenOverlay={() => setOverlayOpen(true)}
        compact
      />

      <div className="game-content" data-testid="game-content">
        {/* Column 1: Player A */}
        <ArmySidebar
          columnKey="A"
          displayName={gameData?.playerA?.displayName}
          inputRef={inputARef}
          hasArmy={hasArmyA}
          uploadError={uploadErrorA}
          onFileInputChange={onFileInputChange}
          onDragOverZone={onDragOverZone}
          onDropZone={onDropZone}
        >
          {hasArmyA ? (
            <ArmyColumn
              columnKey="A"
              title="Player A"
              units={allUnitsA}
              attachments={attachmentsA}
              setAttachments={setAttachmentsA}
              unitOrder={unitOrderA}
              setUnitOrder={setUnitOrderA}
              leadershipOverrides={leadershipOverrides}
              allUnitsById={allUnitsById}
              selectedUnit={selectedUnit}
              setSelectedUnit={setSelectedUnit}
              updateUnitOverrides={updateUnitOverrides}
              getUnitStatusClass={getUnitStatusClass}
              isLeaderUnit={isLeaderUnitVisual}
              canLeaderAttachToUnit={canLeaderAttachToUnit}
              gameId={gameId}
              sensors={sensors}
              draggedUnit={draggedUnit}
              setDraggedUnit={setDraggedUnit}
              pinUnit={pinUnit}
              pinnedUnitId={pinnedUnitIdA}
              pointerRef={pointerRef}
              scrollRafRef={scrollRafRef}
              draggingRef={draggingRef}
              // Attack Helper wiring
              attackHelper={attackHelper}
              setAttackHelper={setAttackHelper}
              pulseTargetId={pulseTargetId}
              setPulseTargetId={setPulseTargetId}
            />
          ) : (
            <div className="empty-army">
              <p>No army yet. Add one to begin.</p>
            </div>
          )}
        </ArmySidebar>

        {/* Column 2: Center area with sticky rail + independent scroll pane */}
        <main className="datasheet-area">
          <DatasheetRail
            selectedUnit={withMergedKeywords.selected}
            attackHelper={attackHelper}
            allUnitsById={allUnitsById}
            defaultTargetUnit={targetUnit}
            onChangeModelsInRange={onChangeModelsInRange}
            onToggleExpected={onToggleExpected}
            gameId={gameId}
            user={user}
          />
          <div className="datasheet-scroll">
            {withMergedKeywords.left || withMergedKeywords.right ? (
              <DatasheetCompare
                leftUnit={withMergedKeywords.left}
                rightUnit={withMergedKeywords.right}
                selectedUnit={withMergedKeywords.selected}
                hasArmyA={hasArmyA}
                hasArmyB={hasArmyB}
                leadershipOverrides={leadershipOverrides}
                allUnits={allUnits}
                updateUnitOverrides={updateUnitOverrides}
                isLeaderUnit={isLeaderUnitVisual}
                canLeaderAttachToUnit={canLeaderAttachToUnit}
                onAttachUnit={(leaderId, childId) =>
                  attachUnitToLeader(leaderId, childId)
                }
                attackHelper={attackHelper}
                onToggleWeaponLeft={onToggleWeaponLeft}
                onToggleWeaponRight={onToggleWeaponRight}
                onCloseAttackHelper={closeAttackHelper}
                onChangeModelsInRange={onChangeModelsInRange}
                onToggleExpected={onToggleExpected}
                targetUnit={withMergedKeywords.target}
              />
            ) : (
              <div className="no-unit-selected">
                {!hasArmyA && !hasArmyB ? (
                  <>
                    <h3>Start by adding armies to both columns</h3>
                    <p>
                      Use the Upload army controls in each column to import an
                      army JSON.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>Select a unit from either column to view details</h3>
                    <p>
                      Click on any unit to see its datasheet and available
                      actions.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Column 3: Player B */}
        <ArmySidebar
          columnKey="B"
          displayName={gameData?.playerB?.displayName}
          inputRef={inputBRef}
          hasArmy={hasArmyB}
          uploadError={uploadErrorB}
          onFileInputChange={onFileInputChange}
          onDragOverZone={onDragOverZone}
          onDropZone={onDropZone}
        >
          {hasArmyB ? (
            <ArmyColumn
              columnKey="B"
              title="Player B"
              units={allUnitsB}
              attachments={attachmentsB}
              setAttachments={setAttachmentsB}
              unitOrder={unitOrderB}
              setUnitOrder={setUnitOrderB}
              leadershipOverrides={leadershipOverrides}
              allUnitsById={allUnitsById}
              selectedUnit={selectedUnit}
              setSelectedUnit={setSelectedUnit}
              updateUnitOverrides={updateUnitOverrides}
              getUnitStatusClass={getUnitStatusClass}
              isLeaderUnit={isLeaderUnitVisual}
              canLeaderAttachToUnit={canLeaderAttachToUnit}
              gameId={gameId}
              sensors={sensors}
              draggedUnit={draggedUnit}
              setDraggedUnit={setDraggedUnit}
              pinUnit={pinUnit}
              pinnedUnitId={pinnedUnitIdB}
              pointerRef={pointerRef}
              scrollRafRef={scrollRafRef}
              draggingRef={draggingRef}
              // Attack Helper wiring
              attackHelper={attackHelper}
              setAttackHelper={setAttackHelper}
              pulseTargetId={pulseTargetId}
              setPulseTargetId={setPulseTargetId}
            />
          ) : (
            <div className="empty-army">
              <p>No army yet. Add one to begin.</p>
            </div>
          )}
        </ArmySidebar>
      </div>
      {/* DiceTray removed; Attack Helper includes integrated rolling */}
      {isNarrow && overlayOpen && selectedUnit ? (
        <DatasheetOverlay
          selectedUnit={withMergedKeywords.selected}
          leftUnit={withMergedKeywords.left}
          rightUnit={withMergedKeywords.right}
          pinnedUnitIdA={pinnedUnitIdA}
          pinnedUnitIdB={pinnedUnitIdB}
          allUnits={allUnits}
          allUnitsById={allUnitsById}
          leadershipOverrides={leadershipOverrides}
          updateUnitOverrides={updateUnitOverrides}
          isLeaderUnit={isLeaderUnitVisual}
          canLeaderAttachToUnit={canLeaderAttachToUnit}
          onAttachUnit={(leaderId, childId) =>
            attachUnitToLeader(leaderId, childId)
          }
          attackHelper={attackHelper}
          setAttackHelper={setAttackHelper}
          targetUnit={targetUnit}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default GameSessionView;
