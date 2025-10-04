import React from "react";
import UnitDatasheet from "components/datasheet/UnitDatasheet";

export default function DatasheetCompare({
  leftUnit,
  rightUnit,
  selectedUnit,
  hasArmyA,
  hasArmyB,
  leadershipOverrides,
  allUnits,
  updateUnitOverrides,
  isLeaderUnit,
  canLeaderAttachToUnit,
  onAttachUnit,
  attackHelper,
  onToggleWeaponLeft,
  onToggleWeaponRight,
  onCloseAttackHelper,
  onChangeModelsInRange,
  onToggleExpected,
  targetUnit,
}) {
  return (
    <div className="datasheet-compare-grid">
      <div className="pane left">
        {leftUnit ? (
          <UnitDatasheet
            unit={leftUnit}
            isSelected={selectedUnit?.id === leftUnit.id}
            onClick={() => {}}
            overrides={
              leadershipOverrides[leftUnit.id] || {
                canLead: "auto",
                canBeLed: "auto",
                allowList: [],
              }
            }
            allUnits={allUnits}
            onUpdateOverrides={(partial) =>
              updateUnitOverrides(leftUnit.id, partial)
            }
            isLeaderUnit={isLeaderUnit}
            canLeaderAttachToUnit={canLeaderAttachToUnit}
            onAttachUnit={onAttachUnit}
            attackHelper={attackHelper}
            onToggleWeapon={onToggleWeaponLeft}
            onCloseAttackHelper={onCloseAttackHelper}
            onChangeModelsInRange={onChangeModelsInRange}
            onToggleExpected={onToggleExpected}
            selectedTargetUnit={targetUnit}
          />
        ) : (
          <div className="no-unit-selected">
            {!hasArmyA && !hasArmyB ? (
              <>
                <h3>Start by adding armies to both columns</h3>
                <p>
                  Use the Upload army controls in each column to import an army
                  JSON.
                </p>
              </>
            ) : (
              <>
                <h3>Select a unit from Player A to view details</h3>
                <p>Click on any unit in the left roster.</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="pane right">
        {rightUnit ? (
          <UnitDatasheet
            unit={rightUnit}
            isSelected={selectedUnit?.id === rightUnit.id}
            onClick={() => {}}
            overrides={
              leadershipOverrides[rightUnit.id] || {
                canLead: "auto",
                canBeLed: "auto",
                allowList: [],
              }
            }
            allUnits={allUnits}
            onUpdateOverrides={(partial) =>
              updateUnitOverrides(rightUnit.id, partial)
            }
            isLeaderUnit={isLeaderUnit}
            canLeaderAttachToUnit={canLeaderAttachToUnit}
            onAttachUnit={onAttachUnit}
            attackHelper={attackHelper}
            onToggleWeapon={onToggleWeaponRight}
            onCloseAttackHelper={onCloseAttackHelper}
            onChangeModelsInRange={onChangeModelsInRange}
            onToggleExpected={onToggleExpected}
            selectedTargetUnit={targetUnit}
          />
        ) : (
          <div className="no-unit-selected">
            {!hasArmyA && !hasArmyB ? (
              <>
                <h3>Start by adding armies to both columns</h3>
                <p>
                  Use the Upload army controls in each column to import an army
                  JSON.
                </p>
              </>
            ) : (
              <>
                <h3>Select a unit from Player B to view details</h3>
                <p>Click on any unit in the right roster.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
