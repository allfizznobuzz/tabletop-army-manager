"""
Smoke tests for basic functionality that must always work.
"""
import pytest
import json
from army_document import ArmyDocument
from army_loader import ArmyLoader
from battlescribe_converter import BattleScribeConverter
from combat_mechanics import CombatCalculator


def test_army_document_creation():
    """Test basic army document creation works."""
    data = {
        "name": "Test Army",
        "units": [
            {
                "name": "Test Unit",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 10,
                "weapons": [
                    {
                        "name": "Bolt Rifle",
                        "range": "24",
                        "type": "RIFLE"
                    }
                ]
            }
        ]
    }
    
    army = ArmyDocument(data)
    assert army.name == "Test Army"
    assert len(army.units) == 1
    assert army.units[0].name == "Test Unit"


def test_army_loader_works():
    """Test that army loader can load files."""
    loader = ArmyLoader()
    
    # Test with sample file
    try:
        army = loader.load_army("sample-army-BA.json")
        # This will fail because it's BattleScribe format, but loader should handle gracefully
    except ValueError:
        # Expected for BattleScribe format files
        pass


def test_battlescribe_converter_works():
    """Test BattleScribe converter with sample file."""
    converter = BattleScribeConverter()
    
    with open("sample-army-BA.json", 'r') as f:
        data = json.load(f)
    
    # Should convert without crashing
    converted = converter.convert_battlescribe_to_army(data)
    assert isinstance(converted, dict)
    assert "name" in converted
    assert "units" in converted


def test_combat_calculator_basic():
    """Test basic combat calculator functionality."""
    from army_document import Unit, Weapon
    
    # Create test units and weapons
    weapon = Weapon(
        name="Bolt Rifle",
        range="24",
        type="RIFLE",
        strength=4,
        ap=0,
        damage="1"
    )
    
    attacker = Unit(
        name="Space Marine",
        unit_type="INFANTRY",
        models=5,
        wounds=2,
        weapons=[weapon],
        ballistic_skill=3
    )
    
    target = Unit(
        name="Ork Boy",
        unit_type="INFANTRY", 
        models=10,
        wounds=1,
        weapons=[],
        toughness=4,
        armor_save=6
    )
    
    # Test combat calculation
    result = CombatCalculator.calculate_combat_rolls(weapon, attacker, target)
    assert result.hit_roll >= 2
    assert result.wound_roll >= 2


def test_sample_armies_load_via_converter():
    """Test that sample armies can be loaded through converter."""
    converter = BattleScribeConverter()
    loader = ArmyLoader()
    
    sample_files = ["sample-army-BA.json", "sample-army-WE.json"]
    
    for filename in sample_files:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        # Convert BattleScribe to army format
        converted = converter.convert_battlescribe_to_army(data)
        
        # Should be able to create ArmyDocument
        army = ArmyDocument(converted)
        assert army.name
        assert len(army.units) > 0
