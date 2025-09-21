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
                    type: 'unit',
                    number: 5,
                    profiles: [
                      {
                        typeName: 'Unit',
                        characteristics: [
                          { name: 'W', $text: '2' },
                          { name: 'WS', $text: '3' },
                          { name: 'BS', $text: '3' },
                          { name: 'T', $text: '4' },
                          { name: 'Sv', $text: '3' }
                        ]
                      },
                      {
                        name: 'Bolter',
                        typeName: 'Weapon',
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
                            typeName: 'Weapon',
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
});
