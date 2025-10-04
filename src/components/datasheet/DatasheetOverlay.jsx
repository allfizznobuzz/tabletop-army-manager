import React from "react";
import AttackHelperPanel from "components/attack/AttackHelperPanel";
import UnitDatasheet from "components/datasheet/UnitDatasheet";
import { resolveWeaponCarrierCount } from "utils/weaponCarrier";

export default function DatasheetOverlay({
  selectedUnit,
  leftUnit,
  rightUnit,
  pinnedUnitIdA,
  pinnedUnitIdB,
  allUnits,
  allUnitsById,
  leadershipOverrides,
  updateUnitOverrides,
  isLeaderUnit,
  canLeaderAttachToUnit,
  onAttachUnit,
  attackHelper,
  setAttackHelper,
  targetUnit,
  onClose,
}) {
  if (!selectedUnit) return null;
  return (
    <div className="datasheet-overlay" role="dialog">
      <button
        type="button"
        className="overlay-close"
        aria-label="Close Datasheet"
        onClick={onClose}
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
        isLeaderUnit={isLeaderUnit}
        canLeaderAttachToUnit={canLeaderAttachToUnit}
        onAttachUnit={onAttachUnit}
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
  );
}
