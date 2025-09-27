// Clean, refactored Army Parser
// Handles both BattleScribe and simple JSON formats with scalable architecture

/**
 * Main entry point for parsing army files
 * Auto-detects format and converts to standardized structure
 */
export const parseArmyFile = (jsonData) => {
  if (jsonData.roster) {
    return convertBattleScribeToSimple(jsonData);
  }
  return validateSimpleFormat(jsonData);
};

/**
 * Converts BattleScribe format to simple format
 */
const convertBattleScribeToSimple = (battleScribeData) => {
  const roster = battleScribeData.roster;
  const forces = roster.forces || [];

  if (forces.length === 0) {
    throw new Error("No forces found in BattleScribe roster");
  }

  const force = forces[0];
  const selections = force.selections || [];

  const armyData = {
    name: (roster && roster.name) || force.name || "Imported Army",
    faction: extractFaction(force),
    units: [],
  };

  // Process each selection to extract units
  selections.forEach((selection) => {
    if (isUnitSelection(selection)) {
      const unit = convertBattleScribeUnit(selection);
      if (unit) {
        armyData.units.push(unit);
      }
    }
  });

  return armyData;
};

/**
 * Converts a single BattleScribe unit selection to simple format
 */
const convertBattleScribeUnit = (selection) => {
  // Initialize unit with defaults
  const unit = createBaseUnit(selection);

  // Extract unit data from BattleScribe structure
  extractUnitStats(selection, unit);
  extractAbilitiesRulesKeywords(selection, unit);
  extractModelGroups(selection, unit);
  extractWeapons(selection, unit);
  extractCosts(selection, unit);

  return unit;
};

/**
 * Creates base unit object with defaults
 */
const createBaseUnit = (selection) => ({
  name: selection.name || "Unknown Unit",
  type: "INFANTRY",
  models: selection.number || 1,
  wounds: 1,
  currentWounds: 1,
  points: 0,
  weapons: [],
  modelGroups: [],
  abilities: [],
  rules: [],
  keywords: [],
});

/**
 * Extracts unit statistics from profiles
 */
const extractUnitStats = (selection, unit) => {
  if (!selection.profiles) return;

  selection.profiles.forEach((profile) => {
    if (profile.typeName === "Unit" && profile.characteristics) {
      profile.characteristics.forEach((char) => {
        const value = char.$text;

        switch (char.name) {
          case "W":
            const wounds = parseInt(value, 10);
            if (isFinite(wounds)) {
              unit.wounds = wounds;
              unit.currentWounds = wounds;
            }
            break;
          case "WS":
            unit.weapon_skill = extractSkillValue(value);
            break;
          case "BS":
            unit.ballistic_skill = extractSkillValue(value);
            break;
          case "T":
            const toughness = parseInt(value, 10);
            if (isFinite(toughness)) unit.toughness = toughness;
            break;
          case "Sv":
            unit.armor_save = extractSkillValue(value);
            break;
          case "Keywords":
            if (value && value !== "-") {
              const keywords = value
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k);
              unit.keywords.push(...keywords);
            }
            break;
          default:
            break;
        }
      });
    }
  });
};

/**
 * Extracts abilities, rules, and keywords from selection
 */
const extractAbilitiesRulesKeywords = (selection, unit) => {
  const processSelection = (sel) => {
    // Extract from profiles
    if (sel.profiles) {
      sel.profiles.forEach((profile) => {
        if (profile.typeName === "Abilities") {
          const description = profile.characteristics?.find(
            (char) => char.name === "Description",
          );
          unit.abilities.push({
            name: profile.name,
            description: description ? description.$text : "",
          });
        }
      });
    }

    // Extract from rules
    if (sel.rules) {
      sel.rules.forEach((rule) => {
        if (rule.name) {
          unit.rules.push(rule.name);
        }
      });
    }

    // Recursively process nested selections
    if (sel.selections) {
      sel.selections.forEach((nestedSel) => processSelection(nestedSel));
    }
  };

  processSelection(selection);
};

/**
 * Extracts model groups from selection
 */
const extractModelGroups = (selection, unit) => {
  const modelGroups = [];
  let totalModels = 0;

  const visit = (sel) => {
    if (!sel) return;
    if (sel.type === "model" && sel.number && sel.name) {
      const modelGroup = {
        name: sel.name,
        count: sel.number,
        weapons: [],
      };
      // Extract weapons for this model group
      extractModelGroupWeapons(sel, modelGroup);
      modelGroups.push(modelGroup);
      totalModels += sel.number;
    }
    if (sel.selections) {
      sel.selections.forEach(visit);
    }
  };

  visit(selection);

  // If we found model groups, use them
  if (modelGroups.length > 0) {
    unit.models = totalModels;
    unit.modelGroups = modelGroups;

    // Create flattened weapons array with one entry per weapon instance
    const expanded = [];
    modelGroups.forEach((group) => {
      group.weapons.forEach((w) => {
        const c = w.count || 1;
        for (let i = 0; i < c; i++) {
          expanded.push({ ...w, count: 1 });
        }
      });
    });
    unit.weapons = expanded;
  }
};

/**
 * Extracts weapons for a specific model group
 */
const extractModelGroupWeapons = (selection, modelGroup) => {
  const processWeaponSelection = (sel) => {
    if (sel.profiles) {
      sel.profiles.forEach((profile) => {
        if (
          profile.typeName === "Ranged Weapons" ||
          profile.typeName === "Melee Weapons"
        ) {
          const weapon = createWeaponFromProfile(profile, sel.number || 1);
          modelGroup.weapons.push(weapon);
        }
      });
    }

    if (sel.selections) {
      sel.selections.forEach((nestedSel) => processWeaponSelection(nestedSel));
    }
  };

  if (selection.selections) {
    selection.selections.forEach((sel) => processWeaponSelection(sel));
  }
};

/**
 * Extracts weapons from selection (fallback for units without model groups)
 */
const extractWeapons = (selection, unit) => {
  // Only extract weapons if we don't have model groups
  if (unit.modelGroups.length > 0) return;

  const weapons = [];

  const processWeaponSelection = (sel) => {
    if (sel.profiles) {
      sel.profiles.forEach((profile) => {
        if (
          profile.typeName === "Ranged Weapons" ||
          profile.typeName === "Melee Weapons"
        ) {
          const weapon = createWeaponFromProfile(profile, sel.number || 1);
          weapons.push(weapon);
        }
      });
    }

    if (sel.selections) {
      sel.selections.forEach((nestedSel) => processWeaponSelection(nestedSel));
    }
  };

  processWeaponSelection(selection);

  // Expand counts into individual weapon entries
  const expanded = [];
  weapons.forEach((w) => {
    const c = w.count || 1;
    for (let i = 0; i < c; i++) {
      expanded.push({ ...w, count: 1 });
    }
  });
  unit.weapons = expanded;
};

/**
 * Creates weapon object from BattleScribe profile
 */
const createWeaponFromProfile = (profile, count = 1) => {
  const weapon = {
    name: profile.name,
    range: '12"',
    type: profile.typeName === "Melee Weapons" ? "Melee" : "Assault 1",
    attacks: 1,
    skill: 4,
    strength: 4,
    ap: 0,
    damage: 1,
    abilities: [],
    count: count,
  };

  // Extract characteristics
  if (profile.characteristics) {
    profile.characteristics.forEach((char) => {
      const value = char.$text;

      switch (char.name) {
        case "Range":
          weapon.range = value || weapon.range;
          break;
        case "Type":
          weapon.type = value || weapon.type;
          break;
        case "A":
          const attacks = parseInt(value, 10);
          weapon.attacks = isFinite(attacks)
            ? attacks
            : value || weapon.attacks;
          break;
        case "WS":
        case "BS":
          weapon.skill = extractSkillValue(value) || weapon.skill;
          break;
        case "S":
          const strength = parseInt(value, 10);
          if (isFinite(strength)) weapon.strength = strength;
          break;
        case "AP":
          const ap = parseInt(value, 10);
          if (isFinite(ap)) weapon.ap = ap;
          break;
        case "D":
          const damage = parseInt(value, 10);
          if (isFinite(damage)) weapon.damage = damage;
          break;
        default:
          break;
      }
    });
  }

  return weapon;
};

// (removed unused groupIdenticalWeapons helper)

/**
 * Extracts costs from selection
 */
const extractCosts = (selection, unit) => {
  if (selection.costs) {
    const pointsCost = selection.costs.find((cost) => cost.name === "pts");
    if (pointsCost) {
      unit.points = pointsCost.value || 0;
    }
  }
};

/**
 * Helper functions
 */
const isUnitSelection = (selection) => {
  return selection.type === "model" || selection.type === "unit";
};

const extractFaction = (force) => {
  if (force.rules && force.rules.length > 0) {
    return force.rules[0].name || "Unknown";
  }
  return "Unknown";
};

const extractSkillValue = (value) => {
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return isFinite(num) ? num : undefined;
    }
  }
  return undefined;
};

/**
 * Validates simple format army data
 */
const validateSimpleFormat = (armyData) => {
  if (!armyData.name) {
    throw new Error("Army must have a name");
  }

  if (!armyData.units || !Array.isArray(armyData.units)) {
    throw new Error("Army must have a units array");
  }

  // Validate and set defaults for each unit
  armyData.units.forEach((unit, unitIndex) => {
    if (!unit.name) {
      throw new Error(`Unit at index ${unitIndex} must have a name`);
    }

    // Set defaults
    unit.type = unit.type || "INFANTRY";
    unit.models = unit.models || 1;
    unit.wounds = unit.wounds || 1;
    unit.currentWounds = unit.currentWounds || unit.wounds;
    unit.points = unit.points || 0;
    unit.weapons = unit.weapons || [];
    unit.modelGroups = unit.modelGroups || [];
    unit.abilities = unit.abilities || [];
    unit.rules = unit.rules || [];
    unit.keywords = unit.keywords || [];

    // Validate weapons
    unit.weapons.forEach((weapon, weaponIndex) => {
      if (!weapon.name) {
        throw new Error(
          `Weapon at index ${weaponIndex} in unit ${unit.name} must have a name`,
        );
      }

      // Set weapon defaults
      weapon.range = weapon.range || '12"';
      weapon.type = weapon.type || "Assault 1";
      weapon.attacks = weapon.attacks || 1;
      weapon.skill = weapon.skill || 4;
      weapon.strength = weapon.strength || 4;
      weapon.ap = weapon.ap || 0;
      weapon.damage = weapon.damage || 1;
      weapon.abilities = weapon.abilities || [];
    });
  });

  return armyData;
};
