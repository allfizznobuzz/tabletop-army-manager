import { parseArmyFile } from './armyParser';

describe('armyParser', () => {
  describe('parseArmyFile', () => {
    describe('Simple JSON format', () => {
      it('should parse valid simple army format', () => {
        const simpleArmy = {
          name: 'Test Army',
          faction: 'Space Marines',
          units: [
            {
              name: 'Tactical Squad',
              type: 'INFANTRY',
              models: 10,
              wounds: 1,
              weapons: [
                {
                  name: 'Bolter',
                  range: '24"',
                  type: 'Rapid Fire 1'
                }
              ]
            }
          ]
        };

        const result = parseArmyFile(simpleArmy);
        
        expect(result.name).toBe('Test Army');
        expect(result.faction).toBe('Space Marines');
        expect(result.units).toHaveLength(1);
        expect(result.units[0].name).toBe('Tactical Squad');
        expect(result.units[0].currentWounds).toBe(1);
      });

      it('should set default values for missing unit fields', () => {
        const armyWithMinimalUnit = {
          name: 'Minimal Army',
          units: [
            {
              name: 'Basic Unit'
            }
          ]
        };

        const result = parseArmyFile(armyWithMinimalUnit);
        const unit = result.units[0];
        
        expect(unit.type).toBe('INFANTRY');
        expect(unit.models).toBe(1);
        expect(unit.wounds).toBe(1);
        expect(unit.currentWounds).toBe(1);
        expect(unit.weapons).toEqual([]);
      });

      it('should set default values for missing weapon fields', () => {
        const armyWithMinimalWeapon = {
          name: 'Army with Weapon',
          units: [
            {
              name: 'Unit with Weapon',
              weapons: [
                {
                  name: 'Basic Weapon'
                }
              ]
            }
          ]
        };

        const result = parseArmyFile(armyWithMinimalWeapon);
        const weapon = result.units[0].weapons[0];
        
        expect(weapon.range).toBe('12"');
        expect(weapon.type).toBe('Assault 1');
        expect(weapon.attacks).toBe(1);
        expect(weapon.skill).toBe(4);
        expect(weapon.strength).toBe(4);
        expect(weapon.ap).toBe(0);
        expect(weapon.damage).toBe(1);
      });

      it('should throw error for army without name', () => {
        const armyWithoutName = {
          units: []
        };

        expect(() => parseArmyFile(armyWithoutName)).toThrow('Army must have a name');
      });

      it('should throw error for army without units array', () => {
        const armyWithoutUnits = {
          name: 'Army without units'
        };

        expect(() => parseArmyFile(armyWithoutUnits)).toThrow('Army must have a units array');
      });

      it('should throw error for unit without name', () => {
        const armyWithUnnamedUnit = {
          name: 'Army',
          units: [
            {
              type: 'INFANTRY'
            }
          ]
        };

        expect(() => parseArmyFile(armyWithUnnamedUnit)).toThrow('Unit at index 0 must have a name');
      });

      it('should throw error for weapon without name', () => {
        const armyWithUnnamedWeapon = {
          name: 'Army',
          units: [
            {
              name: 'Unit',
              weapons: [
                {
                  range: '24"'
                }
              ]
            }
          ]
        };

        expect(() => parseArmyFile(armyWithUnnamedWeapon)).toThrow('Weapon at index 0 in unit Unit must have a name');
      });
    });

    describe('BattleScribe format', () => {
      it('should detect and convert BattleScribe format', () => {
        const battleScribeArmy = {
          roster: {
            forces: [
              {
                name: 'BattleScribe Army',
                rules: [
                  {
                    name: 'Space Marines'
                  }
                ],
                selections: [
                  {
                    id: 'unit1',
                    name: 'Tactical Squad',
                    type: 'model',
                    number: 5,
                    profiles: [
                      {
                        name: 'Tactical Squad',
                        typeName: 'Unit',
                        characteristics: [
                          { name: 'W', $text: '2' },
                          { name: 'WS', $text: '3' },
                          { name: 'BS', $text: '3' },
                          { name: 'T', $text: '4' },
                          { name: 'Sv', $text: '3' }
                        ]
                      }
                    ],
                    selections: [
                      {
                        profiles: [
                          {
                            name: 'Bolter',
                            typeName: 'Ranged Weapons',
                            characteristics: [
                              { name: 'Range', $text: '24"' },
                              { name: 'Type', $text: 'Rapid Fire 1' },
                              { name: 'A', $text: '2' },
                              { name: 'S', $text: '4' },
                              { name: 'AP', $text: '0' },
                              { name: 'D', $text: '1' }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        };

        const result = parseArmyFile(battleScribeArmy);
        
        expect(result.name).toBe('BattleScribe Army');
        expect(result.faction).toBe('Space Marines');
        expect(result.units).toHaveLength(1);
        
        const unit = result.units[0];
        expect(unit.name).toBe('Tactical Squad');
        expect(unit.models).toBe(5);
        expect(unit.wounds).toBe(2);
        expect(unit.currentWounds).toBe(2);
        expect(unit.weapon_skill).toBe(3);
        expect(unit.ballistic_skill).toBe(3);
        expect(unit.toughness).toBe(4);
        expect(unit.armor_save).toBe(3);
        
        expect(unit.weapons).toHaveLength(1);
        const weapon = unit.weapons[0];
        expect(weapon.name).toBe('Bolter');
        expect(weapon.range).toBe('24"');
        expect(weapon.type).toBe('Rapid Fire 1');
        expect(weapon.attacks).toBe(2);
        expect(weapon.strength).toBe(4);
        expect(weapon.ap).toBe(0);
        expect(weapon.damage).toBe(1);
      });

      it('should handle BattleScribe with nested weapon selections', () => {
        const battleScribeWithNestedWeapons = {
          roster: {
            forces: [
              {
                selections: [
                  {
                    id: 'unit1',
                    name: 'Captain',
                    type: 'model',
                    selections: [
                      {
                        profiles: [
                          {
                            name: 'Power Sword',
                            typeName: 'Melee Weapons',
                            characteristics: [
                              { name: 'Range', $text: 'Melee' },
                              { name: 'Type', $text: 'Melee' },
                              { name: 'S', $text: '+1' },
                              { name: 'AP', $text: '-3' }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        };

        const result = parseArmyFile(battleScribeWithNestedWeapons);
        
        expect(result.units).toHaveLength(1);
        expect(result.units[0].weapons).toHaveLength(1);
        expect(result.units[0].weapons[0].name).toBe('Power Sword');
        expect(result.units[0].weapons[0].range).toBe('Melee');
        expect(result.units[0].weapons[0].ap).toBe(-3);
      });

      it('should use default army name when force has no name', () => {
        const battleScribeWithoutName = {
          roster: {
            forces: [
              {
                selections: []
              }
            ]
          }
        };

        const result = parseArmyFile(battleScribeWithoutName);
        expect(result.name).toBe('Imported Army');
        expect(result.faction).toBe('Unknown');
      });

      it('should throw error for BattleScribe with no forces', () => {
        const battleScribeWithoutForces = {
          roster: {
            forces: []
          }
        };

        expect(() => parseArmyFile(battleScribeWithoutForces)).toThrow('No forces found in BattleScribe roster');
      });

      it('should handle BattleScribe with missing roster', () => {
        const battleScribeWithoutRoster = {
          roster: {}
        };

        expect(() => parseArmyFile(battleScribeWithoutRoster)).toThrow('No forces found in BattleScribe roster');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty units array', () => {
        const armyWithEmptyUnits = {
          name: 'Empty Army',
          units: []
        };

        const result = parseArmyFile(armyWithEmptyUnits);
        expect(result.name).toBe('Empty Army');
        expect(result.units).toEqual([]);
      });

      it('should handle units with empty weapons array', () => {
        const armyWithEmptyWeapons = {
          name: 'Army',
          units: [
            {
              name: 'Unarmed Unit',
              weapons: []
            }
          ]
        };

        const result = parseArmyFile(armyWithEmptyWeapons);
        expect(result.units[0].weapons).toEqual([]);
      });

      it('should handle numeric strings in characteristics', () => {
        const battleScribeWithStringNumbers = {
          roster: {
            forces: [
              {
                selections: [
                  {
                    name: 'Test Unit',
                    type: 'unit',
                    profiles: [
                      {
                        typeName: 'Unit',
                        characteristics: [
                          { name: 'W', $text: 'invalid' },
                          { name: 'WS', $text: '3+' }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        };

        const result = parseArmyFile(battleScribeWithStringNumbers);
        const unit = result.units[0];
        
        // Should default to 1 when parsing fails
        expect(unit.wounds).toBe(1);
        expect(unit.currentWounds).toBe(1);
        // Should handle '3+' format
        expect(unit.weapon_skill).toBe(3);
      });
    });
  });

  describe('Nested BattleScribe structure parsing', () => {
    test('should correctly parse Assault Intercessors with sergeant and standard models', () => {
      const assaultIntercessors = {
        name: 'Assault Intercessors with Jump Packs',
        number: 1,
        type: 'unit',
        selections: [
          {
            // Sergeant model
            name: 'Assault Intercessor Sergeant with Jump Pack',
            type: 'model',
            number: 1,
            selections: [
              {
                name: 'Hand Flamer',
                type: 'upgrade',
                number: 1,
                profiles: [{
                  name: 'Hand Flamer',
                  typeName: 'Ranged Weapons',
                  characteristics: [
                    { name: 'Range', $text: '12"' },
                    { name: 'A', $text: 'D6' },
                    { name: 'BS', $text: 'N/A' },
                    { name: 'S', $text: '3' },
                    { name: 'AP', $text: '0' },
                    { name: 'D', $text: '1' }
                  ]
                }]
              },
              {
                name: 'Power Fist',
                type: 'upgrade',
                number: 1,
                profiles: [{
                  name: 'Power Fist',
                  typeName: 'Melee Weapons',
                  characteristics: [
                    { name: 'Range', $text: 'Melee' },
                    { name: 'A', $text: '3' },
                    { name: 'WS', $text: '3+' },
                    { name: 'S', $text: '8' },
                    { name: 'AP', $text: '-2' },
                    { name: 'D', $text: '2' }
                  ]
                }]
              }
            ]
          },
          {
            // Standard models
            name: 'Assault Intercessors with Jump Pack',
            type: 'model',
            number: 9,
            selections: [
              {
                name: 'Astartes Chainsword',
                type: 'upgrade',
                number: 9,
                profiles: [{
                  name: 'Astartes Chainsword',
                  typeName: 'Melee Weapons',
                  characteristics: [
                    { name: 'Range', $text: 'Melee' },
                    { name: 'A', $text: '4' },
                    { name: 'WS', $text: '3+' },
                    { name: 'S', $text: '4' },
                    { name: 'AP', $text: '-1' },
                    { name: 'D', $text: '1' }
                  ]
                }]
              },
              {
                name: 'Heavy Bolt Pistol',
                type: 'upgrade',
                number: 9,
                profiles: [{
                  name: 'Heavy Bolt Pistol',
                  typeName: 'Ranged Weapons',
                  characteristics: [
                    { name: 'Range', $text: '18"' },
                    { name: 'A', $text: '1' },
                    { name: 'BS', $text: '3+' },
                    { name: 'S', $text: '4' },
                    { name: 'AP', $text: '-1' },
                    { name: 'D', $text: '1' }
                  ]
                }]
              }
            ]
          }
        ]
      };

      // Mock console.log to capture debug output
      const originalLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      const result = parseArmyFile({
        roster: {
          forces: [{
            name: 'Test Force',
            selections: [assaultIntercessors]
          }]
        }
      });

      // Restore console.log
      console.log = originalLog;
      
      // Should have 10 total models (1 sergeant + 9 standard)
      expect(result.units[0].models).toBe(10);
      
      // Should have 20 total weapons (1 hand flamer + 1 power fist + 9 chainswords + 9 pistols)
      expect(result.units[0].weapons).toHaveLength(20);
      
      // Count weapons by type
      const weaponCounts = result.units[0].weapons.reduce((counts, weapon) => {
        counts[weapon.name] = (counts[weapon.name] || 0) + 1;
        return counts;
      }, {});
      
      expect(weaponCounts['Hand Flamer']).toBe(1);
      expect(weaponCounts['Power Fist']).toBe(1);
      expect(weaponCounts['Astartes Chainsword']).toBe(9);
      expect(weaponCounts['Heavy Bolt Pistol']).toBe(9);
    });

    test('should correctly parse Death Company Marines with uniform equipment', () => {
      const deathCompany = {
        name: 'Death Company Marines with Jump Packs',
        number: 1,
        type: 'unit',
        selections: [
          {
            name: 'Death Company Marine',
            type: 'model',
            number: 10,
            selections: [
              {
                name: 'Astartes Chainsword',
                type: 'upgrade',
                number: 10,
                profiles: [{
                  name: 'Astartes Chainsword',
                  typeName: 'Melee Weapons',
                  characteristics: [
                    { name: 'Range', $text: 'Melee' },
                    { name: 'A', $text: '4' },
                    { name: 'WS', $text: '3+' },
                    { name: 'S', $text: '4' },
                    { name: 'AP', $text: '-1' },
                    { name: 'D', $text: '1' }
                  ]
                }]
              },
              {
                name: 'Heavy Bolt Pistol',
                type: 'upgrade',
                number: 10,
                profiles: [{
                  name: 'Heavy Bolt Pistol',
                  typeName: 'Ranged Weapons',
                  characteristics: [
                    { name: 'Range', $text: '18"' },
                    { name: 'A', $text: '1' },
                    { name: 'BS', $text: '3+' },
                    { name: 'S', $text: '4' },
                    { name: 'AP', $text: '-1' },
                    { name: 'D', $text: '1' }
                  ]
                }]
              }
            ]
          }
        ]
      };

      const result = parseArmyFile({
        roster: {
          forces: [{
            name: 'Test Force',
            selections: [deathCompany]
          }]
        }
      });
      
      // Should have 10 total models
      expect(result.units[0].models).toBe(10);
      
      // Should have 20 total weapons (10 chainswords + 10 pistols)
      expect(result.units[0].weapons).toHaveLength(20);
      
      // Count weapons by type
      const weaponCounts = result.units[0].weapons.reduce((counts, weapon) => {
        counts[weapon.name] = (counts[weapon.name] || 0) + 1;
        return counts;
      }, {});
      
      expect(weaponCounts['Astartes Chainsword']).toBe(10);
      expect(weaponCounts['Heavy Bolt Pistol']).toBe(10);
    });

    test('should correctly parse character units with multiple weapons', () => {
      const chaplain = {
        name: 'Chaplain with Jump Pack',
        number: 1,
        type: 'model',
        selections: [
          {
            name: 'Crozius Arcanum',
            type: 'upgrade',
            number: 1,
            profiles: [{
              name: 'Crozius Arcanum',
              typeName: 'Melee Weapons',
              characteristics: [
                { name: 'Range', $text: 'Melee' },
                { name: 'A', $text: '5' },
                { name: 'WS', $text: '2+' },
                { name: 'S', $text: '6' },
                { name: 'AP', $text: '-1' },
                { name: 'D', $text: '2' }
              ]
            }]
          },
          {
            name: 'Power Fist',
            type: 'upgrade',
            number: 1,
            profiles: [{
              name: 'Power Fist',
              typeName: 'Melee Weapons',
              characteristics: [
                { name: 'Range', $text: 'Melee' },
                { name: 'A', $text: '4' },
                { name: 'WS', $text: '2+' },
                { name: 'S', $text: '8' },
                { name: 'AP', $text: '-2' },
                { name: 'D', $text: '2' }
              ]
            }]
          }
        ]
      };

      const result = parseArmyFile({
        roster: {
          forces: [{
            name: 'Test Force',
            selections: [chaplain]
          }]
        }
      });
      
      // Should have 1 model
      expect(result.units[0].models).toBe(1);
      
      // Should have 2 weapons
      expect(result.units[0].weapons).toHaveLength(2);
      
      // Check weapon names
      const weaponNames = result.units[0].weapons.map(w => w.name);
      expect(weaponNames).toContain('Crozius Arcanum');
      expect(weaponNames).toContain('Power Fist');
    });

    test('should handle edge case with no weapons', () => {
      const emptyUnit = {
        name: 'Empty Unit',
        number: 1,
        type: 'unit',
        selections: [
          {
            name: 'Model',
            type: 'model',
            number: 5,
            selections: []
          }
        ]
      };

      const result = parseArmyFile({
        roster: {
          forces: [{
            name: 'Test Force',
            selections: [emptyUnit]
          }]
        }
      });
      
      expect(result.units[0].models).toBe(5);
      expect(result.units[0].weapons).toHaveLength(0);
    });

    test('should handle deeply nested selections', () => {
      const nestedUnit = {
        name: 'Nested Unit',
        number: 1,
        type: 'unit',
        selections: [
          {
            name: 'Model Group',
            type: 'upgrade',
            number: 1,
            selections: [
              {
                name: 'Model',
                type: 'model',
                number: 3,
                selections: [
                  {
                    name: 'Weapon',
                    type: 'upgrade',
                    number: 3,
                    profiles: [{
                      name: 'Test Weapon',
                      typeName: 'Ranged Weapons',
                      characteristics: [
                        { name: 'Range', $text: '24"' },
                        { name: 'A', $text: '1' },
                        { name: 'BS', $text: '3+' },
                        { name: 'S', $text: '4' },
                        { name: 'AP', $text: '0' },
                        { name: 'D', $text: '1' }
                      ]
                    }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = parseArmyFile({
        roster: {
          forces: [{
            name: 'Test Force',
            selections: [nestedUnit]
          }]
        }
      });
      
      expect(result.units[0].models).toBe(3);
      expect(result.units[0].weapons).toHaveLength(3);
      expect(result.units[0].weapons[0].name).toBe('Test Weapon');
    });
  });
});
