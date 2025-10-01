import React, { useState, useEffect, useMemo, useRef } from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { updateGameState, subscribeToGame } from "../../firebase/database";
// AuthContext will be implemented later
import UnitDatasheet from "components/game/UnitDatasheet";
import ArmyColumn from "components/game/ArmyColumn";
import AttackHelperPanel from "components/game/AttackHelperPanel";
import { canAttach } from "utils/eligibility";
import { parseArmyFile } from "utils/armyParser";
import { resolveWeaponCarrierCount } from "utils/weaponCarrier";
import useGameSubscription from "hooks/useGameSubscription";
import useMedia from "hooks/useMedia";
import useStickyHeaderHeight from "hooks/useStickyHeaderHeight";
import GameHeader from "components/game/session/GameHeader";
import UploadDropzone from "components/game/session/UploadDropzone";
import ArmySidebar from "components/game/session/ArmySidebar";
import DatasheetRail from "components/game/session/DatasheetRail";
import DatasheetCompare from "components/game/session/DatasheetCompare";

// ArmyColumn renders one player's army column with fully-contained DnD and attach logic.
// It persists state to gameState.columns.<col>.{attachments,unitOrder} and never crosses columns.

// Attached unit sortable is implemented inside ./ArmyColumn

const GameSessionView = ({ gameId, user, gameData: gameDataProp }) => {
  const subscribedGameData = useGameSubscription(gameId, subscribeToGame);
  const gameData = gameDataProp ?? subscribedGameData;
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isNarrow = useMedia("(max-width: 768px)", false);
  const [draggedUnit, setDraggedUnit] = useState(null);
  // Attack Helper state
  const [attackHelper, setAttackHelper] = useState({
    open: false,
    section: null, // 'ranged' | 'melee'
    index: null,
    modelsInRange: null,
    targetUnitId: null,
    attackerUnitId: null,
    intent: "idle", // idle | open_no_target | open_with_target
    showExpected: false,
  });

  // Keep sticky header height synced via hook
  useStickyHeaderHeight(".army-column .column-header", "--army-header-offset");
  const [pulseTargetId, setPulseTargetId] = useState(null);
  const [attachmentsA, setAttachmentsA] = useState({});
  const [attachmentsB, setAttachmentsB] = useState({});
  const [unitOrderA, setUnitOrderA] = useState([]);
  const [unitOrderB, setUnitOrderB] = useState([]);
  const [leadershipOverrides, setLeadershipOverrides] = useState({});
  const pointerRef = useRef({ x: 0, y: 0, has: false });
  const scrollRafRef = useRef(null);
  const draggingRef = useRef(false);
  const inputARef = useRef(null);
  const inputBRef = useRef(null);
  const [uploadErrorA, setUploadErrorA] = useState("");
  const [uploadErrorB, setUploadErrorB] = useState("");
  const lastActionRef = useRef(null);

  // Keep last-clicked unit per column pinned so both datasheets can display
  const [pinnedUnitIdA, setPinnedUnitIdA] = useState(null);
  const [pinnedUnitIdB, setPinnedUnitIdB] = useState(null);

  const pinUnit = (u) => {
    if (!u) return;
    if (u.column === "A") setPinnedUnitIdA(u.id);
    else if (u.column === "B") setPinnedUnitIdB(u.id);
  };

  // gameData provided by useGameSubscription

  // isNarrow provided by useMedia

  // Close overlay when deselecting or when exiting narrow mode
  useEffect(() => {
    if (!isNarrow) setOverlayOpen(false);
    if (!selectedUnit) setOverlayOpen(false);
  }, [isNarrow, selectedUnit]);

  // Do not auto-collapse on attacker change; unit card clicks explicitly reset helper state.
  useEffect(() => {
    if (lastActionRef.current === "toggle_weapon") {
      lastActionRef.current = null;
    }
  }, [selectedUnit?.id]);

  // Collapse when clicking outside both the panel and enemy unit cards
  useEffect(() => {
    if (!attackHelper.open) return;
    const onDocPointer = (e) => {
      const panel = e.target?.closest?.(".attack-helper, .attack-helper-panel");
      if (panel) return; // keep open when interacting with panel
      const unitCard = e.target?.closest?.(".unit-card");
      if (unitCard) {
        // Allow unit click handlers to process (enemy selection)
        return;
      }
      // If a weapon toggle occurred this tick, do not close
      if (lastActionRef.current === "toggle_weapon") {
        lastActionRef.current = null;
        return;
      }
      // Allow weapon row clicks inside datasheets to update selection without closing first
      const weaponRow = e.target?.closest?.(".weapon-row");
      if (weaponRow) return;
      // Also allow any clicks within a datasheet surface
      const datasheet = e.target?.closest?.(".unit-datasheet");
      if (datasheet) return;
      setAttackHelper((prev) => ({
        open: false,
        section: null,
        index: null,
        modelsInRange: null,
        targetUnitId: null,
        attackerUnitId: null,
        intent: "idle",
        showExpected: prev.showExpected,
      }));
    };
    document.addEventListener("pointerup", onDocPointer);
    return () => document.removeEventListener("pointerup", onDocPointer);
  }, [attackHelper.open]);

  // Build full units list (snapshot from gameData)
  const allUnitsA = useMemo(() => {
    if (!gameData?.playerA?.armyData?.units) return [];
    const units = gameData.playerA.armyData.units;
    return units.map((unit, index) => ({
      id: `A_unit_${index}`,
      name: unit.name || "Unknown Unit",
      column: "A",
      playerName: gameData.playerA.displayName || "Player A",
      currentWounds:
        unit.currentWounds !== undefined
          ? unit.currentWounds
          : unit.wounds || 1,
      totalWounds: unit.wounds || 1,
      totalDamage: unit.totalDamage || 0,
      victoryPoints: unit.victoryPoints || 0,
      points: unit.points || 0,
      models: unit.models || unit.size || 1,
      movement: unit.movement,
      weapon_skill: unit.weapon_skill,
      ballistic_skill: unit.ballistic_skill,
      strength: unit.strength,
      toughness: unit.toughness,
      wounds: unit.wounds,
      attacks: unit.attacks,
      leadership: unit.leadership,
      armor_save: unit.armor_save,
      invulnerable_save: unit.invulnerable_save,
      objective_control: unit.objective_control,
      weapons: unit.weapons || [],
      modelGroups: unit.modelGroups || [],
      abilities: unit.abilities || [],
      rules: unit.rules || [],
      keywords: unit.keywords || [],
    }));
  }, [gameData?.playerA?.armyData, gameData?.playerA?.displayName]);

  const allUnitsB = useMemo(() => {
    if (!gameData?.playerB?.armyData?.units) return [];
    const units = gameData.playerB.armyData.units;
    return units.map((unit, index) => ({
      id: `B_unit_${index}`,
      name: unit.name || "Unknown Unit",
      column: "B",
      playerName: gameData.playerB.displayName || "Player B",
      currentWounds:
        unit.currentWounds !== undefined
          ? unit.currentWounds
          : unit.wounds || 1,
      totalWounds: unit.wounds || 1,
      totalDamage: unit.totalDamage || 0,
      victoryPoints: unit.victoryPoints || 0,
      points: unit.points || 0,
      models: unit.models || unit.size || 1,
      movement: unit.movement,
      weapon_skill: unit.weapon_skill,
      ballistic_skill: unit.ballistic_skill,
      strength: unit.strength,
      toughness: unit.toughness,
      wounds: unit.wounds,
      attacks: unit.attacks,
      leadership: unit.leadership,
      armor_save: unit.armor_save,
      invulnerable_save: unit.invulnerable_save,
      objective_control: unit.objective_control,
      weapons: unit.weapons || [],
      modelGroups: unit.modelGroups || [],
      abilities: unit.abilities || [],
      rules: unit.rules || [],
      keywords: unit.keywords || [],
    }));
  }, [gameData?.playerB?.armyData, gameData?.playerB?.displayName]);

  const allUnits = useMemo(
    () => [...allUnitsA, ...allUnitsB],
    [allUnitsA, allUnitsB],
  );

  const allUnitsById = useMemo(() => {
    const map = {};
    allUnits.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [allUnits]);

  // Resolve attacker/defender for compare view
  const pinnedA = pinnedUnitIdA ? allUnitsById[pinnedUnitIdA] : null;
  const pinnedB = pinnedUnitIdB ? allUnitsById[pinnedUnitIdB] : null;
  const leftUnit =
    pinnedA || (selectedUnit?.column === "A" ? selectedUnit : null);
  const rightUnit =
    pinnedB || (selectedUnit?.column === "B" ? selectedUnit : null);
  const targetUnit = selectedUnit
    ? selectedUnit.column === "A"
      ? rightUnit || null
      : leftUnit || null
    : null;

  // Per-column ordering is managed inside ArmyColumn

  // Placeholder approach needs no visual order effect

  // Sync per-column state from backend
  useEffect(() => {
    const a = gameData?.gameState?.columns?.A?.attachments || {};
    setAttachmentsA(a);
  }, [gameData?.gameState?.columns?.A?.attachments]);

  useEffect(() => {
    const b = gameData?.gameState?.columns?.B?.attachments || {};
    setAttachmentsB(b);
  }, [gameData?.gameState?.columns?.B?.attachments]);

  useEffect(() => {
    const orderA = gameData?.gameState?.columns?.A?.unitOrder;
    if (Array.isArray(orderA)) setUnitOrderA(orderA);
  }, [gameData?.gameState?.columns?.A?.unitOrder]);

  useEffect(() => {
    const orderB = gameData?.gameState?.columns?.B?.unitOrder;
    if (Array.isArray(orderB)) setUnitOrderB(orderB);
  }, [gameData?.gameState?.columns?.B?.unitOrder]);

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
      updateGameState(gameId, { "gameState.leadershipOverrides": next }).catch(
        (err) => console.error("persist overrides failed", err),
      );
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
  const isLeaderUnit = (unit) => {
    if (!unit) return false;
    const ov = leadershipOverrides[unit.id];
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

  // Baseline source-data check (strict, from abilities text)
  const sourceCanAttach = (leader, draggedUnit) => {
    if (!leader || !draggedUnit) return false;
    // Must actually have a Leader ability
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
    // Try without trailing "with ..." qualifiers for broader matching
    const unitBase = normalize(draggedUnit.name.replace(/\bwith\b.*$/, ""));

    // Look for explicit attach permission mentioning the target unit
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
      // Must reference the unit by name (full or base)
      return text.includes(unitFull) || text.includes(unitBase);
    });
  };

  // Centralized eligibility helpers are imported from ../../utils/eligibility
  const canLeaderAttachToUnit = (leader, draggedUnit) => {
    return canAttach(leader, draggedUnit, leadershipOverrides, sourceCanAttach);
  };

  // Import army from a selected or dropped file
  const importArmyFromFile = async (columnKey, file) => {
    if (!file || !file.name.toLowerCase().endsWith(".json")) {
      const msg = `Unsupported file type for ${file ? file.name : "unknown file"}. Please select a .json file.`;
      columnKey === "A" ? setUploadErrorA(msg) : setUploadErrorB(msg);
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = parseArmyFile(json);
      const base = columnKey === "A" ? "playerA" : "playerB";
      const order = (parsed.units || []).map(
        (_, i) => `${columnKey}_unit_${i}`,
      );
      await updateGameState(gameId, {
        [`${base}.armyData`]: parsed,
        [`gameState.columns.${columnKey}.attachments`]: {},
        [`gameState.columns.${columnKey}.unitOrder`]: order,
      });
      // clear errors
      columnKey === "A" ? setUploadErrorA("") : setUploadErrorB("");
    } catch (e) {
      const msg = `Failed to import ${file.name}: ${e.message || e}`;
      columnKey === "A" ? setUploadErrorA(msg) : setUploadErrorB(msg);
    }
  };

  const onFileInputChange = async (columnKey, e) => {
    const files = e.target.files;
    if (files && files[0]) {
      await importArmyFromFile(columnKey, files[0]);
      // reset input so selecting the same file again triggers change
      e.target.value = "";
    }
  };

  const onDragOverZone = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const onDropZone = async (columnKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await importArmyFromFile(columnKey, file);
    }
  };

  // Determine whose turn it is
  const isMyTurn = gameData?.currentTurn === user?.uid;

  const hasArmyA = !!gameData?.playerA?.armyData;
  const hasArmyB = !!gameData?.playerB?.armyData;

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
              isLeaderUnit={isLeaderUnit}
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
            selectedUnit={selectedUnit}
            attackHelper={attackHelper}
            allUnitsById={allUnitsById}
            defaultTargetUnit={targetUnit}
            onChangeModelsInRange={(val) =>
              setAttackHelper((prev) => ({
                ...prev,
                modelsInRange: Math.max(1, Number(val) || 1),
              }))
            }
            onToggleExpected={() =>
              setAttackHelper((prev) => ({
                ...prev,
                showExpected: !prev.showExpected,
              }))
            }
          />
          <div className="datasheet-scroll">
            {leftUnit || rightUnit ? (
              <DatasheetCompare
                leftUnit={leftUnit}
                rightUnit={rightUnit}
                selectedUnit={selectedUnit}
                hasArmyA={hasArmyA}
                hasArmyB={hasArmyB}
                leadershipOverrides={leadershipOverrides}
                allUnits={allUnits}
                updateUnitOverrides={updateUnitOverrides}
                attackHelper={attackHelper}
                onToggleWeaponLeft={(section, index, weapon) => {
                  if (!pinnedUnitIdB && rightUnit)
                    setPinnedUnitIdB(rightUnit.id);
                  lastActionRef.current = "toggle_weapon";
                  setAttackHelper((prev) => {
                    const defaultModels = resolveWeaponCarrierCount(
                      leftUnit,
                      weapon,
                    );
                    let nextTargetId =
                      prev.targetUnitId ||
                      pinnedUnitIdB ||
                      (rightUnit ? rightUnit.id : null);
                    if (nextTargetId) {
                      const cand = allUnitsById[nextTargetId];
                      if (!cand || cand.column === leftUnit.column)
                        nextTargetId = null;
                    }
                    const hasTarget = !!nextTargetId;
                    return {
                      open: true,
                      section,
                      index,
                      modelsInRange: defaultModels,
                      targetUnitId: nextTargetId,
                      attackerUnitId: leftUnit.id,
                      intent: hasTarget ? "open_with_target" : "open_no_target",
                      showExpected: prev.showExpected,
                    };
                  });
                  setSelectedUnit(leftUnit);
                }}
                onToggleWeaponRight={(section, index, weapon) => {
                  if (!pinnedUnitIdA && leftUnit) setPinnedUnitIdA(leftUnit.id);
                  lastActionRef.current = "toggle_weapon";
                  setAttackHelper((prev) => {
                    const defaultModels = resolveWeaponCarrierCount(
                      rightUnit,
                      weapon,
                    );
                    let nextTargetId =
                      prev.targetUnitId ||
                      pinnedUnitIdA ||
                      (leftUnit ? leftUnit.id : null);
                    if (nextTargetId) {
                      const cand = allUnitsById[nextTargetId];
                      if (!cand || cand.column === rightUnit.column)
                        nextTargetId = null;
                    }
                    const hasTarget = !!nextTargetId;
                    return {
                      open: true,
                      section,
                      index,
                      modelsInRange: defaultModels,
                      targetUnitId: nextTargetId,
                      attackerUnitId: rightUnit.id,
                      intent: hasTarget ? "open_with_target" : "open_no_target",
                      showExpected: prev.showExpected,
                    };
                  });
                  setSelectedUnit(rightUnit);
                }}
                onCloseAttackHelper={() =>
                  setAttackHelper({
                    open: false,
                    section: null,
                    index: null,
                    modelsInRange: null,
                    targetUnitId: null,
                    intent: "idle",
                    showExpected: attackHelper?.showExpected,
                  })
                }
                onChangeModelsInRange={(val) =>
                  setAttackHelper((prev) => ({
                    ...prev,
                    modelsInRange: Math.max(1, Number(val) || 1),
                  }))
                }
                onToggleExpected={() =>
                  setAttackHelper((prev) => ({
                    ...prev,
                    showExpected: !prev.showExpected,
                  }))
                }
                targetUnit={targetUnit}
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
              isLeaderUnit={isLeaderUnit}
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
      {isNarrow && overlayOpen && selectedUnit ? (
        <div className="datasheet-overlay" role="dialog">
          <button
            type="button"
            className="overlay-close"
            aria-label="Close Datasheet"
            onClick={() => setOverlayOpen(false)}
          ></button>
          {selectedUnit ? (
            <AttackHelperPanel
              selectedUnit={selectedUnit}
              attackHelper={attackHelper}
              allUnitsById={allUnitsById}
              defaultTargetUnit={targetUnit}
              onChangeModelsInRange={(val) =>
                setAttackHelper((prev) => ({
                  ...prev,
                  modelsInRange: Math.max(1, Number(val) || 1),
                }))
              }
              onToggleExpected={() =>
                setAttackHelper((prev) => ({
                  ...prev,
                  showExpected: !prev.showExpected,
                }))
              }
            />
          ) : null}
          <UnitDatasheet
            unit={selectedUnit}
            isSelected={true}
            onClick={() => {}}
            overrides={
              leadershipOverrides[selectedUnit.id] || {
                canLead: "auto",
                canBeLed: "auto",
                allowList: [],
              }
            }
            allUnits={allUnits}
            onUpdateOverrides={(partial) =>
              updateUnitOverrides(selectedUnit.id, partial)
            }
            // Attack Helper props
            attackHelper={attackHelper}
            onToggleWeapon={(section, index, weapon) => {
              setAttackHelper((prev) => {
                const same =
                  prev.open &&
                  prev.attackerUnitId === selectedUnit.id &&
                  prev.section === section &&
                  prev.index === index;
                if (same)
                  return {
                    open: false,
                    section: null,
                    index: null,
                    modelsInRange: null,
                    targetUnitId: null,
                    attackerUnitId: null,
                    intent: "idle",
                    showExpected: prev.showExpected,
                  };
                const defaultModels = resolveWeaponCarrierCount(
                  selectedUnit,
                  weapon,
                );
                const nextTargetId =
                  prev.targetUnitId ||
                  (selectedUnit?.column === "A"
                    ? pinnedUnitIdB || (rightUnit ? rightUnit.id : null)
                    : pinnedUnitIdA || (leftUnit ? leftUnit.id : null));
                const hasTarget = !!nextTargetId;
                return {
                  open: true,
                  section,
                  index,
                  modelsInRange: defaultModels,
                  targetUnitId: nextTargetId,
                  attackerUnitId: selectedUnit.id,
                  intent: hasTarget ? "open_with_target" : "open_no_target",
                };
              });
            }}
            onCloseAttackHelper={() =>
              setAttackHelper({
                open: false,
                section: null,
                index: null,
                modelsInRange: null,
                targetUnitId: null,
                intent: "idle",
              })
            }
            onChangeModelsInRange={(val) =>
              setAttackHelper((prev) => ({
                ...prev,
                modelsInRange: Math.max(1, Number(val) || 1),
              }))
            }
            onToggleExpected={() =>
              setAttackHelper((prev) => ({
                ...prev,
                showExpected: !prev.showExpected,
              }))
            }
            selectedTargetUnit={
              attackHelper.targetUnitId
                ? allUnitsById[attackHelper.targetUnitId]
                : null
            }
          />
        </div>
      ) : null}
    </div>
  );
};

export default GameSessionView;
