import pytest
from army_document import ArmyDocument

def test_load_army_document():
    """Test loading a basic army document."""
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
    assert army.units[0].weapons[0].name == "Bolt Rifle"

def test_invalid_army_document():
    """Test loading an invalid army document."""
    with pytest.raises(ValueError):
        ArmyDocument({})

def test_weapon_tracking():
    """Test weapon tracking functionality."""
    data = {
        "name": "Test Army",
        "units": [
            {
                "name": "Test Unit",
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
    unit = army.units[0]
    weapon = unit.weapons[0]
    
    assert not weapon.fired
    weapon.mark_fired()
    assert weapon.fired
    army.reset_turn()
    assert not weapon.fired
