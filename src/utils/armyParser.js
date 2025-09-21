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
    name: selection.name || 'Unknown Unit',
    type: 'INFANTRY',
    models: 0,
    wounds: 1,
    currentWounds: 1,
    points: 0,
    weapons: [],
    modelGroups: []
  };
  
  // Scoped debug logger; enable by setting process.env.DEBUG_ARMY_PARSER = '1'
  const dbg = (...args) => {
    try {
      if (typeof process !== 'undefined' && process.env && process.env.DEBUG_ARMY_PARSER === '1') {
        console.log(...args);
      }
    } catch (_) {
      // ignore if process/env not available
    }
  };
  
  // Generic scalable approach: analyze BattleScribe structure to detect model groups
  dbg(`\n=== ANALYZING UNIT STRUCTURE: ${unit.name} ===`);
  
  // Look for nested model selections in BattleScribe data
  const detectedModelGroups = [];
  let totalModelsDetected = 0;
  
  if (selection.selections) {
    selection.selections.forEach(sel => {
      if (sel.type === 'model' && sel.number && sel.name) {
        dbg(`Found model group: ${sel.name} (count: ${sel.number})`);
        
        // Collect weapons for this model group
        const modelGroupWeapons = [];
        const collectModelWeapons = (selections) => {
          if (!selections) return;
          selections.forEach(weaponSel => {
            if (weaponSel.profiles) {
              weaponSel.profiles.forEach(profile => {
                if (profile.typeName === 'Ranged Weapons' || profile.typeName === 'Melee Weapons') {
                  const weaponCount = weaponSel.number || 1;
                  
                  // Create weapon object
                  const weapon = {
                    name: profile.name,
                    range: '',
                    type: profile.typeName === 'Melee Weapons' ? 'Melee' : 'Assault 1',
                    attacks: 1,
                    skill: 4,
                    strength: 4,
                    ap: 0,
                    damage: 1,
                    abilities: [],
                    count: weaponCount
                  };
                  
                  // Extract characteristics
                  if (profile.characteristics) {
                    profile.characteristics.forEach(char => {
                      const val = char.$text;
                      switch (char.name) {
                        case 'Range':
                          weapon.range = val || weapon.range;
                          break;
                        case 'Type':
                          weapon.type = val || weapon.type;
                          break;
                        case 'A': {
                          const n = parseInt(val, 10);
                          weapon.attacks = isFinite(n) ? n : (val || weapon.attacks);
                          break;
                        }
                        case 'WS':
                        case 'BS': {
                          const m = typeof val === 'string' ? val.match(/(\d+)/) : null;
                          const n = m ? parseInt(m[1], 10) : NaN;
                          weapon.skill = isFinite(n) ? n : weapon.skill;
                          break;
                        }
                        case 'S': {
                          const n = parseInt(val, 10);
                          weapon.strength = isFinite(n) ? n : weapon.strength;
                          break;
                        }
                        case 'AP': {
                          const n = parseInt(val, 10);
                          weapon.ap = isFinite(n) ? n : weapon.ap;
                          break;
                        }
                        case 'D': {
                          const n = parseInt(val, 10);
                          weapon.damage = isFinite(n) ? n : weapon.damage;
                          break;
                        }
                      }
                    });
                  }
                  
                  modelGroupWeapons.push(weapon);
                  dbg(`  Added weapon: ${weapon.name} (x${weapon.count})`);
                }
              });
            }
            if (weaponSel.selections) {
              collectModelWeapons(weaponSel.selections);
            }
          });
        };
        
        collectModelWeapons(sel.selections);
        
        // Create model group
        detectedModelGroups.push({
          name: sel.name,
          count: sel.number,
          weapons: modelGroupWeapons
        });
        
        totalModelsDetected += sel.number;
      }
    });
  }
  
  // If we found model groups, use them
  if (detectedModelGroups.length > 0) {
    dbg(`✅ Found ${detectedModelGroups.length} model groups, total models: ${totalModelsDetected}`);
    
    unit.models = totalModelsDetected;
    unit.modelGroups = detectedModelGroups;
    
    // Create flattened weapons array for backward compatibility
    unit.weapons = [];
    detectedModelGroups.forEach(group => {
      unit.weapons.push(...group.weapons);
    });
    
    dbg(`\n--- DETECTED MODEL GROUPS ---`);
    detectedModelGroups.forEach((group, i) => {
      dbg(`Group ${i + 1}: ${group.count}x ${group.name}`);
      dbg(`  Weapons: ${group.weapons.length}`);
      group.weapons.forEach(weapon => {
        dbg(`    - ${weapon.name} (x${weapon.count})`);
      });
    });
    dbg(`=== END STRUCTURE ANALYSIS ===\n`);
    
    return unit;
  } else {
    dbg(`❌ No model groups detected, falling back to original parsing`);
  }
  
  // Extract points cost
  if (selection.costs) {
    const pointsCost = selection.costs.find(cost => cost.name === 'pts');
    if (pointsCost) {
      unit.points = pointsCost.value || 0;
    }
  }
  
  // If the selection itself is a model, set the model count
  if (selection.type === 'model' || selection.type === 'unit') {
    unit.models = selection.number || 1;
  }
  
  // Track model groups separately to maintain sergeant/standard separation
  const modelGroups = [];
  const weapons = unit.weapons; // Reference to the unit's weapons array for fallback

  // Find and parse the unit's own characteristics from its profiles
  if (selection.profiles) {
    selection.profiles.forEach(profile => {
      if (profile.typeName === 'Unit') {
        if (profile.characteristics) {
          profile.characteristics.forEach(char => {
            const val = char.$text;
            switch (char.name) {
              case 'W': {
                const n = parseInt(val, 10);
                unit.wounds = isFinite(n) ? n : 1;
                unit.currentWounds = unit.wounds;
                break;
              }
              case 'WS': {
                const m = typeof val === 'string' ? val.match(/(\d+)/) : null;
                const n = m ? parseInt(m[1], 10) : NaN;
                unit.weapon_skill = isFinite(n) ? n : undefined;
                break;
              }
              case 'BS': {
                const m = typeof val === 'string' ? val.match(/(\d+)/) : null;
                const n = m ? parseInt(m[1], 10) : NaN;
                unit.ballistic_skill = isFinite(n) ? n : undefined;
                break;
              }
              case 'T': {
                const n = parseInt(val, 10);
                unit.toughness = isFinite(n) ? n : undefined;
                break;
              }
              case 'Sv': {
                const m = typeof val === 'string' ? val.match(/(\d+)/) : null;
                const n = m ? parseInt(m[1], 10) : NaN;
                unit.armor_save = isFinite(n) ? n : undefined;
                break;
              }
            }
          });
        }
      }
    });
  }

  // Recursively extract weapons from all nested selections and count models
  const extractWeaponsFromSelections = (selections, depth = 0) => {
    if (!selections) return;
    
    const indent = '  '.repeat(depth);
    dbg(`${indent}Processing ${selections.length} selections at depth ${depth}`);
    
    selections.forEach((selection, index) => {
      dbg(`${indent}Selection ${index}: type="${selection.type}", name="${selection.name}", number=${selection.number}`);
      
      // Check if this is a model selection to count models
      // We only add if it's a nested model group, to avoid double-counting the top-level unit
      if (depth > 0 && selection.type === 'model' && selection.number) {
        dbg(`${indent}  -> Adding ${selection.number} models to unit`);
        unit.models += selection.number;
        
        // Create a separate model group for this selection
        const modelGroup = {
          name: selection.name,
          count: selection.number,
          weapons: []
        };
        
        // Extract weapons from this model's nested selections
        if (selection.selections) {
          dbg(`${indent}  -> Processing ${selection.selections.length} weapon selections for this model group`);
          selection.selections.forEach((weaponSelection, weaponIndex) => {
            dbg(`${indent}    Weapon selection ${weaponIndex}: type="${weaponSelection.type}", name="${weaponSelection.name}", number=${weaponSelection.number}`);
            
            if (weaponSelection.profiles) {
              weaponSelection.profiles.forEach((profile, profileIndex) => {
                dbg(`${indent}      Profile ${profileIndex}: typeName="${profile.typeName}", name="${profile.name}"`);
                
                if (profile.typeName === 'Ranged Weapons' || profile.typeName === 'Melee Weapons') {
                  // In BattleScribe, the weapon selection number IS the total count for this model group
                  const totalWeapons = weaponSelection.number || 1;
                  
                  dbg(`${indent}        -> Creating ${totalWeapons} instances of weapon: ${profile.name}`);
                  
                  for (let i = 0; i < totalWeapons; i++) {
                    const weapon = {
                      name: profile.name,
                      range: '12"',
                      type: profile.typeName === 'Melee Weapons' ? 'Melee' : 'Assault 1',
                      attacks: 1,
                      skill: 4,
                      strength: 4,
                      ap: 0,
                      damage: 1,
                      abilities: []
                    };
                    
                    // Extract weapon characteristics
                    if (profile.characteristics) {
                      profile.characteristics.forEach(char => {
                        const val = char.$text;
                        switch (char.name) {
                          case 'Range':
                            weapon.range = val || weapon.range;
                            break;
                          case 'Type':
                            weapon.type = val || weapon.type;
                            break;
                          case 'A': {
                            const n = parseInt(val, 10);
                            weapon.attacks = isFinite(n) ? n : (val || weapon.attacks);
                            break;
                          }
                          case 'WS':
                          case 'BS': {
                            // Expect like '3+' -> 3
                            const m = typeof val === 'string' ? val.match(/(\d+)/) : null;
                            const n = m ? parseInt(m[1], 10) : NaN;
                            weapon.skill = isFinite(n) ? n : weapon.skill;
                            break;
                          }
                          case 'S': {
                            const n = parseInt(val, 10);
                            weapon.strength = isFinite(n) ? n : weapon.strength;
                            break;
                          }
                          case 'AP': {
                            const n = parseInt(val, 10);
                            weapon.ap = isFinite(n) ? n : weapon.ap;
                            break;
                          }
                          case 'D': {
                            const n = parseInt(val, 10);
                            weapon.damage = isFinite(n) ? n : weapon.damage;
                            break;
                          }
                          case 'Keywords':
                            if (val && val !== '-') {
                              weapon.abilities = val.split(',').map(a => a.trim());
                            }
                            break;
                        }
                      });
                    }
                    
                    modelGroup.weapons.push(weapon);
                  }
                }
              });
            }
          });
        }
        
        // Add this model group to the list
        modelGroups.push(modelGroup);
        
        // IMPORTANT: Do not recurse into this model's selections again, we've already processed its weapons
        dbg(`${indent}  -> Skipping recursion into model's selections to avoid double-counting`);
        return; // Continue to next selection
      }

      // Process any selection that has weapon profiles (upgrade selections or direct weapon selections)
      if (selection.profiles && selection.type !== 'model') {
        const count = selection.number || 1;
        dbg(`${indent}  -> Found selection with profiles, type="${selection.type}", processing ${selection.profiles.length} profiles`);
        selection.profiles.forEach((profile, profileIndex) => {
          dbg(`${indent}    Profile ${profileIndex}: typeName="${profile.typeName}", name="${profile.name}", count=${count}`);
          if (profile.typeName === 'Ranged Weapons' || profile.typeName === 'Melee Weapons') {
            dbg(`${indent}      -> Creating ${count} weapons of type: ${profile.name}`);
            for (let i = 0; i < count; i++) {
              const weapon = {
                name: profile.name,
                range: '12"',
                type: profile.typeName === 'Melee Weapons' ? 'Melee' : 'Assault 1',
                attacks: 1,
                skill: 4,
                strength: 4,
                ap: 0,
                damage: 1,
                abilities: []
              };
              if (profile.characteristics) {
                profile.characteristics.forEach(char => {
                  const val = char.$text;
                  switch (char.name) {
                    case 'Range':
                      weapon.range = val || weapon.range;
                      break;
                    case 'Type':
                      weapon.type = val || weapon.type;
                      break;
                    case 'A': {
                      const n = parseInt(val, 10);
                      weapon.attacks = isFinite(n) ? n : (val || weapon.attacks);
                      break;
                    }
                    case 'WS':
                    case 'BS': {
                      const m = typeof val === 'string' ? val.match(/(\d+)/) : null;
                      const n = m ? parseInt(m[1], 10) : NaN;
                      weapon.skill = isFinite(n) ? n : weapon.skill;
                      break;
                    }
                    case 'S': {
                      const n = parseInt(val, 10);
                      weapon.strength = isFinite(n) ? n : weapon.strength;
                      break;
                    }
                    case 'AP': {
                      const n = parseInt(val, 10);
                      weapon.ap = isFinite(n) ? n : weapon.ap;
                      break;
                    }
                    case 'D': {
                      const n = parseInt(val, 10);
                      weapon.damage = isFinite(n) ? n : weapon.damage;
                      break;
                    }
                    case 'Keywords':
                      if (val && val !== '-') {
                        weapon.abilities = val.split(',').map(a => a.trim());
                      }
                      break;
                  }
                });
              }
              weapons.push(weapon);
            }
          }
        });
      }

      // Recursively check nested selections for non-model nodes
      if (selection.selections) {
        dbg(`${indent}  -> Recursively processing ${selection.selections.length} nested selections`);
        extractWeaponsFromSelections(selection.selections, depth + 1);
      }
    });
  };
  
  dbg(`\n=== Starting weapon extraction for unit: ${unit.name} ===`);
  if (selection.selections) {
    extractWeaponsFromSelections(selection.selections);
  }
  
  dbg(`\n=== Final results for unit: ${unit.name} ===`);
  dbg(`Total models: ${unit.models}`);
  dbg(`Total weapons: ${weapons.length}`);
  
  // Group weapons by name for summary
  const weaponSummary = {};
  weapons.forEach(weapon => {
    weaponSummary[weapon.name] = (weaponSummary[weapon.name] || 0) + 1;
  });
  
  dbg('Weapon summary:');
  Object.entries(weaponSummary).forEach(([name, count]) => {
    dbg(`  ${name}: ${count}`);
  });
  dbg('=== End weapon extraction ===\n');
  
  // If we have model groups, use them; otherwise fall back to the old weapons array
  if (modelGroups.length > 0) {
    // Group identical weapons within each model group
    modelGroups.forEach(modelGroup => {
      const groupedWeapons = [];
      const weaponMap = new Map();
      
      modelGroup.weapons.forEach(weapon => {
        const key = `${weapon.name}|${weapon.range}|${weapon.type}|${weapon.attacks}|${weapon.skill}|${weapon.strength}|${weapon.ap}|${weapon.damage}`;
        
        if (weaponMap.has(key)) {
          weaponMap.get(key).count++;
        } else {
          const groupedWeapon = { ...weapon, count: 1 };
          weaponMap.set(key, groupedWeapon);
          groupedWeapons.push(groupedWeapon);
        }
      });
      
      modelGroup.weapons = groupedWeapons;
    });
    
    // Store model groups in the unit
    unit.modelGroups = modelGroups;
    
    // Also create a flattened weapons array for backward compatibility
    unit.weapons = [];
    modelGroups.forEach(group => {
      unit.weapons.push(...group.weapons);
    });
    
    dbg(`Model groups: ${modelGroups.length}`);
    modelGroups.forEach(group => {
      dbg(`  ${group.count}x ${group.name}: ${group.weapons.length} weapon types`);
      group.weapons.forEach(weapon => {
        dbg(`    ${weapon.name} (x${weapon.count})`);
      });
    });
  } else {
    // Fallback: group weapons in the main weapons array
    const groupedWeapons = [];
    const weaponMap = new Map();
    
    weapons.forEach(weapon => {
      const key = `${weapon.name}|${weapon.range}|${weapon.type}|${weapon.attacks}|${weapon.skill}|${weapon.strength}|${weapon.ap}|${weapon.damage}`;
      
      if (weaponMap.has(key)) {
        weaponMap.get(key).count++;
      } else {
        const groupedWeapon = { ...weapon, count: 1 };
        weaponMap.set(key, groupedWeapon);
        groupedWeapons.push(groupedWeapon);
      }
    });
    
    unit.weapons = groupedWeapons;
    
    dbg(`Grouped weapons: ${groupedWeapons.length} unique weapon types`);
    groupedWeapons.forEach(weapon => {
      dbg(`  ${weapon.name} (x${weapon.count})`);
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
      case 'Keywords':
        weapon.abilities = char.$text ? [char.$text] : [];
        break;
      case 'A':
        weapon.attacks = parseInt(char.$text) || 1;
        break;
      case 'BS':
      case 'WS':
        weapon.skill = parseInt(char.$text) || 4;
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
