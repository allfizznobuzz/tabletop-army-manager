"""
Integration tests for combat workflow.
Tests the complete flow from unit selection to combat calculation.
"""
import pytest
from tabletop_army_manager import TabletopArmyManager
from army_document import ArmyDocument, Unit, Weapon
from combat_mechanics import CombatCalculator, TargetSelector


def test_complete_combat_workflow(qtbot):
    """Test complete combat workflow from unit selection to calculation."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Create test armies
    attacking_army_data = {
        "name": "Attacking Army",
        "units": [
            {
                "name": "Space Marine Squad",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 10,
                "ballistic_skill": 3,
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
    
    defending_army_data = {
        "name": "Defending Army", 
        "units": [
            {
                "name": "Ork Boyz",
                "type": "INFANTRY",
                "models": 10,
                "wounds": 10,
                "toughness": 4,
                "armor_save": 6,
                "weapons": []
            }
        ]
    }
    
    attacking_army = ArmyDocument(attacking_army_data)
    defending_army = ArmyDocument(defending_army_data)
    
    # Test target selector workflow
    selector = TargetSelector()
    selector.set_armies(attacking_army, defending_army)
    
    # Select attacking unit
    attacking_unit = attacking_army.units[0]
    selector.select_attacking_unit(attacking_unit)
    assert selector.selected_attacking_unit == attacking_unit
    
    # Select weapon
    weapon = attacking_unit.weapons[0]
    selector.select_weapon(weapon)
    assert selector.selected_weapon == weapon
    
    # Select target
    target_unit = defending_army.units[0]
    selector.select_target_unit(target_unit)
    assert selector.selected_target_unit == target_unit
    
    # Get combat calculation
    assert selector.is_ready_for_calculation()
    result = selector.get_combat_calculation()
    
    assert result is not None
    assert result.hit_roll >= 2
    assert result.wound_roll >= 2


def test_combat_calculation_edge_cases():
    """Test combat calculations with edge case stats."""
    # Create extreme stat units
    super_weapon = Weapon(
        name="Super Weapon",
        range="48",
        type="HEAVY",
        strength=10,
        ap=-4,
        damage="D6"
    )
    
    weak_attacker = Unit(
        name="Weak Unit",
        unit_type="INFANTRY",
        models=1,
        wounds=1,
        weapons=[super_weapon],
        ballistic_skill=6  # Poor skill
    )
    
    tough_target = Unit(
        name="Tough Target",
        unit_type="VEHICLE",
        models=1,
        wounds=12,
        weapons=[],
        toughness=8,
        armor_save=2,
        invulnerable_save=4
    )
    
    # Test calculation
    result = CombatCalculator.calculate_combat_rolls(super_weapon, weak_attacker, tough_target)
    
    # Verify reasonable results (adjust expectations based on actual combat mechanics)
    assert result.hit_roll >= 2  # Valid hit roll
    assert result.wound_roll >= 2  # Valid wound roll
    assert result.save_roll >= 2  # Valid save roll
    assert result.invuln_save_roll == 4  # 4+ invuln


def test_weapon_tracking_workflow():
    """Test weapon fired tracking through combat workflow."""
    # Create army data in correct format for ArmyDocument
    army_data = {
        "name": "Test Army",
        "units": [
            {
                "name": "Test Unit",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 5,
                "weapons": [
                    {
                        "name": "Test Weapon",
                        "range": "24",
                        "type": "RIFLE"
                    }
                ]
            }
        ]
    }
    
    army = ArmyDocument(army_data)
    unit = army.units[0]
    weapon = unit.weapons[0]
    
    # Test weapon tracking
    assert not weapon.fired
    weapon.mark_fired()
    assert weapon.fired
    
    # Test turn reset
    army.reset_turn()
    assert not weapon.fired
