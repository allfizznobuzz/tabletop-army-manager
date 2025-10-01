import { useMemo } from "react";

export default function useCompareUnits(
  selectedUnit,
  pinnedUnitIdA,
  pinnedUnitIdB,
  allUnitsById,
) {
  const pinnedA = pinnedUnitIdA ? allUnitsById[pinnedUnitIdA] : null;
  const pinnedB = pinnedUnitIdB ? allUnitsById[pinnedUnitIdB] : null;

  const leftUnit = useMemo(() => {
    return pinnedA || (selectedUnit?.column === "A" ? selectedUnit : null);
  }, [pinnedA, selectedUnit]);

  const rightUnit = useMemo(() => {
    return pinnedB || (selectedUnit?.column === "B" ? selectedUnit : null);
  }, [pinnedB, selectedUnit]);

  const targetUnit = useMemo(() => {
    if (!selectedUnit) return null;
    return selectedUnit.column === "A" ? rightUnit || null : leftUnit || null;
  }, [selectedUnit, leftUnit, rightUnit]);

  return { leftUnit, rightUnit, targetUnit };
}
