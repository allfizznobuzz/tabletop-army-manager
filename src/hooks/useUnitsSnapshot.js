import { useMemo } from "react";

export default function useUnitsSnapshot(gameData) {
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

  return { allUnitsA, allUnitsB, allUnits, allUnitsById };
}
