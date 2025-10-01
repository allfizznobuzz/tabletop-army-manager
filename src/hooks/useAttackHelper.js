import { useEffect, useRef, useState, useCallback } from "react";
import { resolveWeaponCarrierCount } from "../utils/weaponCarrier";

/**
 * Centralizes Attack Helper state, click-away behavior, and weapon toggles.
 */
export default function useAttackHelper({
  leftUnit,
  rightUnit,
  pinnedUnitIdA,
  pinnedUnitIdB,
  setPinnedUnitIdA,
  setPinnedUnitIdB,
  allUnitsById,
  setSelectedUnit,
}) {
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

  const lastActionRef = useRef(null);

  // Outside click-away behavior
  useEffect(() => {
    if (!attackHelper.open) return;
    const onDocPointer = (e) => {
      const panel = e.target?.closest?.(".attack-helper, .attack-helper-panel");
      if (panel) return;
      const unitCard = e.target?.closest?.(".unit-card");
      if (unitCard) return;
      if (lastActionRef.current === "toggle_weapon") {
        lastActionRef.current = null;
        return;
      }
      const weaponRow = e.target?.closest?.(".weapon-row");
      if (weaponRow) return;
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

  // Handlers used by center compare
  const onToggleWeaponLeft = useCallback(
    (section, index, weapon) => {
      if (!leftUnit) return;
      if (!pinnedUnitIdB && rightUnit) setPinnedUnitIdB?.(rightUnit.id);
      lastActionRef.current = "toggle_weapon";
      setAttackHelper((prev) => {
        const defaultModels = resolveWeaponCarrierCount(leftUnit, weapon);
        let nextTargetId =
          prev.targetUnitId ||
          pinnedUnitIdB ||
          (rightUnit ? rightUnit.id : null);
        if (nextTargetId) {
          const cand = allUnitsById[nextTargetId];
          if (!cand || cand.column === leftUnit.column) nextTargetId = null;
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
      setSelectedUnit?.(leftUnit);
    },
    [
      leftUnit,
      rightUnit,
      pinnedUnitIdB,
      setPinnedUnitIdB,
      allUnitsById,
      setSelectedUnit,
    ],
  );

  const onToggleWeaponRight = useCallback(
    (section, index, weapon) => {
      if (!rightUnit) return;
      if (!pinnedUnitIdA && leftUnit) setPinnedUnitIdA?.(leftUnit.id);
      lastActionRef.current = "toggle_weapon";
      setAttackHelper((prev) => {
        const defaultModels = resolveWeaponCarrierCount(rightUnit, weapon);
        let nextTargetId =
          prev.targetUnitId || pinnedUnitIdA || (leftUnit ? leftUnit.id : null);
        if (nextTargetId) {
          const cand = allUnitsById[nextTargetId];
          if (!cand || cand.column === rightUnit.column) nextTargetId = null;
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
      setSelectedUnit?.(rightUnit);
    },
    [
      rightUnit,
      leftUnit,
      pinnedUnitIdA,
      setPinnedUnitIdA,
      allUnitsById,
      setSelectedUnit,
    ],
  );

  const onChangeModelsInRange = useCallback((val) => {
    setAttackHelper((prev) => ({
      ...prev,
      modelsInRange: Math.max(1, Number(val) || 1),
    }));
  }, []);

  const onToggleExpected = useCallback(() => {
    setAttackHelper((prev) => ({
      ...prev,
      showExpected: !prev.showExpected,
    }));
  }, []);

  const close = useCallback(() => {
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
  }, []);

  return {
    attackHelper,
    setAttackHelper,
    onToggleWeaponLeft,
    onToggleWeaponRight,
    onChangeModelsInRange,
    onToggleExpected,
    close,
  };
}
