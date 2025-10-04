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

// Ensure a unit has a consistent shape for UI/tests
const ensureUnitDefaults = (unit) => {
  const out = { ...unit };
  if (out.move == null) out.move = '6"';
  if (out.leadership == null) out.leadership = 7;
  if (out.oc == null) out.oc = 1;
  if (out.wounds == null) out.wounds = 1;
  if (out.currentWounds == null) out.currentWounds = out.wounds;
  if (!Array.isArray(out.weapons)) out.weapons = [];
  if (!Array.isArray(out.modelGroups)) out.modelGroups = [];
  if (!Array.isArray(out.abilities)) out.abilities = [];
  if (!Array.isArray(out.rules)) out.rules = [];
  if (!Array.isArray(out.keywords)) out.keywords = [];
  return out;
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
  const factionAbilityName = extractFaction(force);
  selections.forEach((selection) => {
    if (isUnitSelection(selection)) {
      const unit = convertBattleScribeUnit(selection);
      if (unit) {
        const withDefaults = ensureUnitDefaults(unit);
        if (factionAbilityName)
          withDefaults.factionAbilityName = factionAbilityName;
        armyData.units.push(withDefaults);
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
  // common header defaults; will be overwritten if present in profiles
  move: '6"',
  armor_save: 3,
  leadership: 7,
  oc: 1,
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
        const name = (char.name || "").toLowerCase();

        switch (name) {
          case "m":
            // Movement usually like 7" – keep as provided string
            if (value && value !== "-") unit.move = value;
            break;
          case "w":
            const wounds = parseInt(value, 10);
            if (isFinite(wounds)) {
              unit.wounds = wounds;
              unit.currentWounds = wounds;
            }
            break;
          case "ws":
            unit.weapon_skill = extractSkillValue(value);
            break;
          case "bs":
            unit.ballistic_skill = extractSkillValue(value);
            break;
          case "t":
            const toughness = parseInt(value, 10);
            if (isFinite(toughness)) unit.toughness = toughness;
            break;
          case "sv":
          case "save":
            unit.armor_save = extractSkillValue(value);
            break;
          case "ld":
          case "leadership":
            // Store as number (e.g., 7) so UI can render as 7+
            {
              const ld = extractSkillValue(value);
              if (ld !== undefined) unit.leadership = ld;
            }
            break;
          case "oc":
            {
              const oc = parseInt(value, 10);
              if (isFinite(oc)) unit.oc = oc;
            }
            break;
          case "keywords":
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
  const seen = new Set(
    (unit.keywords || []).map((k) => String(k).toLowerCase()),
  );
  const pushKeyword = (name) => {
    if (!name) return;
    let k = String(name).trim();
    // Strip BattleScribe-style faction prefix
    k = k.replace(/^Faction:\s*/i, "");
    const lower = k.toLowerCase();
    // Skip config/noise groups common in BS exports
    const blacklist = new Set([
      "configuration",
      "show/hide options",
      "battle size",
    ]);
    if (!k || blacklist.has(lower)) return;
    if (!seen.has(lower)) {
      unit.keywords.push(k);
      seen.add(lower);
    }
  };

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
          // Detect invulnerable save values within ability text (e.g., "This model has a 4+ invulnerable save.")
          try {
            const nameStr = String(profile.name || "").toLowerCase();
            const descStr = String(description?.$text || "").toLowerCase();
            const hay = `${nameStr} ${descStr}`;
            if (/invulnerable/.test(hay) || /daemon(ic)?\s*save/.test(hay)) {
              const m = (description?.$text || "").match(/(\d)\s*\+/);
              if (m) {
                const inv = parseInt(m[1], 10);
                if (Number.isFinite(inv)) unit.invulnerable_save = inv;
              }
            }
          } catch (e) {
            // best effort; ignore parsing errors
          }
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

    // Extract from categories (treat as unit keywords)
    if (Array.isArray(sel.categories)) {
      sel.categories.forEach((cat) => pushKeyword(cat?.name));
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
    keywords: [],
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
          {
            const damageNum = parseInt(value, 10);
            if (
              Number.isFinite(damageNum) &&
              String(value).trim().match(/^\d+$/)
            ) {
              weapon.damage = damageNum;
            } else {
              // Preserve dice notation like D6, D6+2, 2D3+1
              weapon.damage = value || weapon.damage;
            }
          }
          break;
        case "Keywords":
          if (typeof value === "string" && value.trim()) {
            const arr = value
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean);
            weapon.keywords.push(...arr);
          }
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
    unit.move = unit.move || '6"';
    // leadership stored as number (e.g., 7), render with '+' in UI
    if (unit.leadership === undefined || unit.leadership === null) {
      unit.leadership = 7;
    }
    if (unit.oc === undefined || unit.oc === null) {
      unit.oc = 1;
    }
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
