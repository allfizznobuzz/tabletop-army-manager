// Army parser utility to handle both BattleScribe and simple JSON formats
// Based on the existing Python converter logic

export const parseArmyFile = (jsonData) => {
  // Auto-detect BattleScribe format (has 'roster' key)
  if (jsonData.roster) {
    return convertBattleScribeToSimple(jsonData);
  }
  
  // Already in simple format, validate and return
  return validateSimpleFormat(jsonData);
};

const convertBattleScribeToSimple = (battleScribeData) => {
  const roster = battleScribeData.roster;
  const forces = roster.forces || [];
  
  if (forces.length === 0) {
    throw new Error('No forces found in BattleScribe roster');
  }
  
  const force = forces[0]; // Use first force
  const selections = force.selections || [];
  
  // Extract army name from force or use default
  const armyName = force.name || 'Imported Army';
  
  // Extract faction from force rules or categories
  let faction = 'Unknown';
  if (force.rules && force.rules.length > 0) {
    faction = force.rules[0].name || 'Unknown';
  }
  
  const units = [];
  
  // Process selections to extract units
  selections.forEach(selection => {
    if (selection.type === 'model' || selection.type === 'unit') {
      const unit = convertBattleScribeUnit(selection);
      if (unit) {
        units.push(unit);
      }
    }
  });
  
  return {
    name: armyName,
    faction: faction,
    units: units
  };
};

const convertBattleScribeUnit = (selection) => {
  const unit = {
    id: selection.id || generateId(),
    name: selection.name || 'Unknown Unit',
    type: 'INFANTRY', // Default type
    models: selection.number || 1,
    wounds: 1, // Default wounds
    currentWounds: 1,
    weapons: []
  };
  
  // Extract profiles for stats
  if (selection.profiles) {
    selection.profiles.forEach(profile => {
      if (profile.typeName === 'Unit') {
        // Extract unit stats from characteristics
        const chars = profile.characteristics || [];
        chars.forEach(char => {
          switch (char.name) {
            case 'W':
              unit.wounds = parseInt(char.$text) || 1;
              unit.currentWounds = unit.wounds;
              break;
            case 'WS':
              unit.weapon_skill = parseInt(char.$text) || 4;
              break;
            case 'BS':
              unit.ballistic_skill = parseInt(char.$text) || 4;
              break;
            case 'T':
              unit.toughness = parseInt(char.$text) || 4;
              break;
            case 'Sv':
              unit.armor_save = parseInt(char.$text) || 6;
              break;
          }
        });
      } else if (profile.typeName === 'Weapon') {
        // Extract weapon
        const weapon = convertBattleScribeWeapon(profile);
        if (weapon) {
          unit.weapons.push(weapon);
        }
      }
    });
  }
  
  // Process nested selections for weapons
  if (selection.selections) {
    selection.selections.forEach(subSelection => {
      if (subSelection.profiles) {
        subSelection.profiles.forEach(profile => {
          if (profile.typeName === 'Weapon') {
            const weapon = convertBattleScribeWeapon(profile);
            if (weapon) {
              unit.weapons.push(weapon);
            }
          }
        });
      }
    });
  }
  
  return unit;
};

const convertBattleScribeWeapon = (profile) => {
  const weapon = {
    name: profile.name || 'Unknown Weapon',
    range: '12"', // Default
    type: 'Assault 1', // Default
    attacks: 1,
    skill: 4,
    strength: 4,
    ap: 0,
    damage: 1
  };
  
  // Extract weapon stats from characteristics
  const chars = profile.characteristics || [];
  chars.forEach(char => {
    switch (char.name) {
      case 'Range':
        weapon.range = char.$text || '12"';
        break;
      case 'Type':
        weapon.type = char.$text || 'Assault 1';
        break;
      case 'A':
        weapon.attacks = parseInt(char.$text) || 1;
        break;
      case 'S':
        weapon.strength = parseInt(char.$text) || 4;
        break;
      case 'AP':
        weapon.ap = parseInt(char.$text) || 0;
        break;
      case 'D':
        weapon.damage = parseInt(char.$text) || 1;
        break;
    }
  });
  
  return weapon;
};

const validateSimpleFormat = (armyData) => {
  // Validate required fields
  if (!armyData.name) {
    throw new Error('Army must have a name');
  }
  
  if (!armyData.units || !Array.isArray(armyData.units)) {
    throw new Error('Army must have a units array');
  }
  
  // Validate each unit
  armyData.units.forEach((unit, index) => {
    if (!unit.name) {
      throw new Error(`Unit at index ${index} must have a name`);
    }
    
    // Set defaults for missing fields
    unit.type = unit.type || 'INFANTRY';
    unit.models = unit.models || 1;
    unit.wounds = unit.wounds || 1;
    unit.currentWounds = unit.currentWounds || unit.wounds;
    unit.weapons = unit.weapons || [];
    
    // Validate weapons
    unit.weapons.forEach((weapon, weaponIndex) => {
      if (!weapon.name) {
        throw new Error(`Weapon at index ${weaponIndex} in unit ${unit.name} must have a name`);
      }
      weapon.range = weapon.range || '12"';
      weapon.type = weapon.type || 'Assault 1';
      weapon.attacks = weapon.attacks || 1;
      weapon.skill = weapon.skill || 4;
      weapon.strength = weapon.strength || 4;
      weapon.ap = weapon.ap || 0;
      weapon.damage = weapon.damage || 1;
    });
  });
  
  return armyData;
};

const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};
