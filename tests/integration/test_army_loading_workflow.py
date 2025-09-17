"""
Integration tests for army loading workflow.
Tests the complete flow from file loading to UI display.
"""
import pytest
import json
from tabletop_army_manager import TabletopArmyManager
from army_document import ArmyDocument
from battlescribe_converter import BattleScribeConverter


def test_battlescribe_army_loading_workflow(qtbot):
    """Test complete workflow of loading a BattleScribe army file."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Load sample BattleScribe file
    with open("sample-army-BA.json", 'r') as f:
        battlescribe_data = json.load(f)
    
    # Convert using converter
    converter = BattleScribeConverter()
    converted_data = converter.convert_battlescribe_to_army(battlescribe_data)
    
    # Create army document
    army = ArmyDocument(converted_data)
    
    # Verify army loaded correctly
    assert army.name
    assert len(army.units) > 0
    
    # Verify units have required attributes
    for unit in army.units:
        assert hasattr(unit, 'name')
        assert hasattr(unit, 'weapons')
        assert hasattr(unit, 'wounds')


def test_simple_json_army_loading_workflow(qtbot):
    """Test loading a simple JSON army format."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Create simple army data
    army_data = {
        "name": "Test Integration Army",
        "units": [
            {
                "name": "Test Squad",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 10,
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
    
    # Load army
    army = ArmyDocument(army_data)
    
    # Verify complete workflow
    assert army.name == "Test Integration Army"
    assert len(army.units) == 1
    assert army.units[0].name == "Test Squad"
    assert len(army.units[0].weapons) == 1
    assert army.units[0].weapons[0].name == "Bolt Rifle"


def test_army_loading_error_handling(qtbot):
    """Test error handling in army loading workflow."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Test invalid army data
    invalid_data = {"invalid": "data"}
    
    with pytest.raises(ValueError):
        ArmyDocument(invalid_data)
    
    # Test missing required fields
    incomplete_data = {"name": "Test Army"}  # Missing units
    
    with pytest.raises(ValueError):
        ArmyDocument(incomplete_data)
