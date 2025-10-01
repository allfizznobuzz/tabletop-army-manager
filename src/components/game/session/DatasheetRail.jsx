import React from "react";
import AttackHelperPanel from "components/game/AttackHelperPanel";

export default function DatasheetRail({
  selectedUnit,
  attackHelper,
  allUnitsById,
  defaultTargetUnit,
  onChangeModelsInRange,
  onToggleExpected,
}) {
  return (
    <div className="datasheet-sticky-rail">
      {selectedUnit ? (
        <AttackHelperPanel
          selectedUnit={selectedUnit}
          attackHelper={attackHelper}
          allUnitsById={allUnitsById}
          defaultTargetUnit={defaultTargetUnit}
          onChangeModelsInRange={onChangeModelsInRange}
          onToggleExpected={onToggleExpected}
        />
      ) : null}
    </div>
  );
}
