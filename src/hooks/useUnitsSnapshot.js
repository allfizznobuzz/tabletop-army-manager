import { useMemo } from "react";

export default function useUnitsSnapshot(gameData) {
  // Resolve per-column army source supporting both new (playerA/B) and legacy (playerArmies) schemas
  const resolveColumn = (col) => {
    const key = col === "A" ? "playerA" : "playerB";
    const direct = gameData?.[key];
    if (direct?.armyData) {
      return {
        armyData: direct.armyData,
        displayName:
          direct.displayName || (col === "A" ? "Player A" : "Player B"),
      };
    }
    // Fallback: playerArmies map by players array index
    const players = Array.isArray(gameData?.players) ? gameData.players : [];
    const uid = col === "A" ? players[0] : players[1];
    const pa =
      uid && gameData?.playerArmies ? gameData.playerArmies[uid] : null;
    if (pa?.armyData) {
      return {
        armyData: pa.armyData,
        displayName: pa.playerName || (col === "A" ? "Player A" : "Player B"),
      };
    }
    return {
      armyData: null,
      displayName: col === "A" ? "Player A" : "Player B",
    };
  };
  const numFromPlus = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const m = v.match(/(\d+)/);
      if (m) return Number(m[1]);
    }
    return undefined;
  };
  const extractInvulnFromAbilities = (abilities) => {
    if (!Array.isArray(abilities)) return undefined;
    for (const ab of abilities) {
      try {
        const name = String(ab?.name || "").toLowerCase();
        const desc = String(ab?.description || "").toLowerCase();
        if (
          /invulnerable/.test(name) ||
          /invulnerable/.test(desc) ||
          /daemon(ic)?\s*save/.test(desc)
        ) {
          const m = String(ab?.description || "").match(/(\d)\s*\+/);
          if (m) return Number(m[1]);
        }
      } catch (_) {}
    }
    return undefined;
  };
  const allUnitsA = useMemo(() => {
    const src = resolveColumn("A");
    if (!src.armyData?.units) return [];
    const units = src.armyData.units;
    const armyFaction = src.armyData?.faction || null;
    return units.map((unit, index) => {
      const move = unit.move ?? unit.movement ?? '6"';
      const armor_save = numFromPlus(unit.armor_save) ?? numFromPlus(unit.save);
      const leadership = numFromPlus(unit.leadership) ?? numFromPlus(unit.Ld);
      const oc =
        unit.oc ?? unit.objective_control ?? unit.objectiveControl ?? 1;
      const invulnerable_save =
        numFromPlus(unit.invulnerable_save) ??
        extractInvulnFromAbilities(unit.abilities);
      const keywords = Array.isArray(unit.keywords)
        ? unit.keywords.map((k) => String(k))
        : [];
      return {
        id: `A_unit_${index}`,
        name: unit.name || "Unknown Unit",
        column: "A",
        playerName: src.displayName || "Player A",
        currentWounds:
          unit.currentWounds !== undefined
            ? unit.currentWounds
            : unit.wounds || 1,
        totalWounds: unit.wounds || 1,
        totalDamage: unit.totalDamage || 0,
        victoryPoints: unit.victoryPoints || 0,
        points: unit.points || 0,
        models: unit.models || unit.size || 1,
        move,
        weapon_skill: unit.weapon_skill,
        ballistic_skill: unit.ballistic_skill,
        strength: unit.strength,
        toughness: unit.toughness,
        wounds: unit.wounds,
        attacks: unit.attacks,
        leadership: leadership ?? 7,
        armor_save: armor_save ?? 3,
        invulnerable_save,
        oc,
        weapons: unit.weapons || [],
        modelGroups: unit.modelGroups || [],
        abilities: unit.abilities || [],
        rules: unit.rules || [],
        keywords,
        factionAbilityName: unit.factionAbilityName || armyFaction,
      };
    });
  }, [gameData?.playerA, gameData?.playerArmies, gameData?.players]);

  const allUnitsB = useMemo(() => {
    const src = resolveColumn("B");
    if (!src.armyData?.units) return [];
    const units = src.armyData.units;
    const armyFaction = src.armyData?.faction || null;
    return units.map((unit, index) => {
      const move = unit.move ?? unit.movement ?? '6"';
      const armor_save = numFromPlus(unit.armor_save) ?? numFromPlus(unit.save);
      const leadership = numFromPlus(unit.leadership) ?? numFromPlus(unit.Ld);
      const oc =
        unit.oc ?? unit.objective_control ?? unit.objectiveControl ?? 1;
      const invulnerable_save =
        numFromPlus(unit.invulnerable_save) ??
        extractInvulnFromAbilities(unit.abilities);
      const keywords = Array.isArray(unit.keywords)
        ? unit.keywords.map((k) => String(k))
        : [];
      return {
        id: `B_unit_${index}`,
        name: unit.name || "Unknown Unit",
        column: "B",
        playerName: src.displayName || "Player B",
        currentWounds:
          unit.currentWounds !== undefined
            ? unit.currentWounds
            : unit.wounds || 1,
        totalWounds: unit.wounds || 1,
        totalDamage: unit.totalDamage || 0,
        victoryPoints: unit.victoryPoints || 0,
        points: unit.points || 0,
        models: unit.models || unit.size || 1,
        move,
        weapon_skill: unit.weapon_skill,
        ballistic_skill: unit.ballistic_skill,
        strength: unit.strength,
        toughness: unit.toughness,
        wounds: unit.wounds,
        attacks: unit.attacks,
        leadership: leadership ?? 7,
        armor_save: armor_save ?? 3,
        invulnerable_save,
        oc,
        weapons: unit.weapons || [],
        modelGroups: unit.modelGroups || [],
        abilities: unit.abilities || [],
        rules: unit.rules || [],
        keywords,
        factionAbilityName: unit.factionAbilityName || armyFaction,
      };
    });
  }, [gameData?.playerB, gameData?.playerArmies, gameData?.players]);

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
