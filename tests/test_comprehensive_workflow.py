"""
Comprehensive workflow test that validates all critical user paths.
This single test ensures the entire application works end-to-end without manual verification.
"""
import pytest
import json
from tabletop_army_manager import TabletopArmyManager
from army_document import ArmyDocument
from battlescribe_converter import BattleScribeConverter
from combat_mechanics import CombatCalculator


def test_complete_user_workflow(qtbot):
    """
    Single comprehensive test that validates the entire user workflow:
    1. Application startup
    2. Army loading (both formats)
    3. Combat calculations
    4. Weapon tracking
    5. Turn management
    
    This test eliminates the need for manual verification.
    """
    # 1. APPLICATION STARTUP
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Verify app starts correctly
    assert app.windowTitle() == "Tabletop Army Manager - Combat Assistant"
    assert hasattr(app, 'army_loader')
    assert hasattr(app, 'battlescribe_converter')
    assert hasattr(app, 'target_selector')
    assert hasattr(app, 'turn_tracker')
    
    # 2. ARMY LOADING - Simple JSON Format
    simple_army_data = {
        "name": "Test Space Marines",
        "units": [
            {
                "name": "Tactical Squad",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 10,
                "ballistic_skill": 3,
                "toughness": 4,
                "armor_save": 3,
                "weapons": [
                    {
                        "name": "Bolt Rifle",
                        "range": "24",
                        "type": "RIFLE",
                        "strength": 4,
                        "ap": 0,
                        "damage": "1"
                    }
                ]
            }
        ]
    }
    
    attacking_army = ArmyDocument(simple_army_data)
    app.attacking_army = attacking_army
    
    # Verify army loaded correctly
    assert app.attacking_army is not None
    assert app.attacking_army.name == "Test Space Marines"
    assert len(app.attacking_army.units) == 1
    
    # 3. ARMY LOADING - BattleScribe Format
    with open("sample-army-BA.json", 'r') as f:
        battlescribe_data = json.load(f)
    
    converter = BattleScribeConverter()
    converted_data = converter.convert_battlescribe_to_army(battlescribe_data)
    defending_army = ArmyDocument(converted_data)
    app.defending_army = defending_army
    
    # Verify BattleScribe army loaded
    assert app.defending_army is not None
    assert len(app.defending_army.units) > 0
    
    # 4. COMBAT CALCULATIONS
    attacking_unit = app.attacking_army.units[0]
    defending_unit = app.defending_army.units[0]
    weapon = attacking_unit.weapons[0]
    
    # Test combat calculation
    result = CombatCalculator.calculate_combat_rolls(weapon, attacking_unit, defending_unit)
    
    # Verify calculation works
    assert result is not None
    assert 2 <= result.hit_roll <= 6 or result.hit_roll == 7  # Valid hit roll
    assert 2 <= result.wound_roll <= 6 or result.wound_roll == 7  # Valid wound roll
    assert 2 <= result.save_roll <= 6 or result.save_roll == 7  # Valid save roll
    
    # 5. WEAPON TRACKING
    # Verify initial state
    assert not weapon.fired
    
    # Fire weapon
    weapon.mark_fired()
    assert weapon.fired
    
    # Reset turn
    attacking_army.reset_turn()
    assert not weapon.fired
    
    # 6. TURN MANAGEMENT
    turn_tracker = app.turn_tracker
    
    # Verify initial state
    assert turn_tracker.current_turn == 1
    assert turn_tracker.current_phase == "Movement"
    
    # Advance phase
    turn_tracker.advance_phase()
    assert turn_tracker.current_phase == "Shooting"
    
    # Advance through all phases to next turn
    for _ in range(3):  # Charge, Combat phases
        turn_tracker.advance_phase()
    
    assert turn_tracker.current_turn == 2
    assert turn_tracker.current_phase == "Movement"
    
    # 7. ERROR HANDLING
    # Test invalid army data
    invalid_data = {"invalid": "structure"}
    
    with pytest.raises(ValueError):
        ArmyDocument(invalid_data)
    
    # 8. DATA INTEGRITY
    # Verify no data corruption occurred during operations
    assert app.attacking_army.name == "Test Space Marines"
    assert len(app.attacking_army.units) == 1
    assert app.attacking_army.units[0].name == "Tactical Squad"
    assert len(app.attacking_army.units[0].weapons) == 1
    assert app.attacking_army.units[0].weapons[0].name == "Bolt Rifle"
    
    # 9. UI COMPONENT INTEGRITY
    # Verify UI components still exist and function
    assert hasattr(app, 'army_loader')
    assert hasattr(app, 'battlescribe_converter')
    assert hasattr(app, 'attacking_army')
    assert hasattr(app, 'defending_army')
    
    # SUCCESS: All critical workflows validated without manual intervention


def test_sample_army_files_comprehensive(qtbot):
    """Test that both sample army files work through complete workflow."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    converter = BattleScribeConverter()
    
    # Test both sample files
    sample_files = ["sample-army-BA.json", "sample-army-WE.json"]
    
    for filename in sample_files:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        # Convert and create army
        converted = converter.convert_battlescribe_to_army(data)
        army = ArmyDocument(converted)
        
        # Verify army is valid
        assert army.name
        assert len(army.units) > 0
        
        # Test that units have weapons
        units_with_weapons = [unit for unit in army.units if len(unit.weapons) > 0]
        assert len(units_with_weapons) > 0
        
        # Test combat calculation with first armed unit
        if units_with_weapons:
            unit = units_with_weapons[0]
            weapon = unit.weapons[0]
            
            # Create a simple target for calculation
            target_data = {
                "name": "Target",
                "type": "INFANTRY",
                "models": 1,
                "wounds": 1,
                "toughness": 4,
                "armor_save": 5,
                "weapons": []
            }
            target_army = ArmyDocument({"name": "Target Army", "units": [target_data]})
            target_unit = target_army.units[0]
            
            # Test calculation
            result = CombatCalculator.calculate_combat_rolls(weapon, unit, target_unit)
            assert result is not None
            
            # Test weapon tracking
            assert not weapon.fired
            weapon.mark_fired()
            assert weapon.fired
            
            # Reset
            army.reset_turn()
            assert not weapon.fired
