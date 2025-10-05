import React from "react";
import AttackHelperPanel from "../attack/AttackHelperPanel";

export default function DatasheetRail({
  selectedUnit,
  attackHelper,
  allUnitsById,
  defaultTargetUnit,
  onChangeModelsInRange,
  onToggleExpected,
  gameId,
  user,
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
          gameId={gameId}
          user={user}
        />
      ) : null}
    </div>
  );
}
