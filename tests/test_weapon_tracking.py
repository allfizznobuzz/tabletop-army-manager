import pytest
from PySide6.QtWidgets import QApplication
from tabletop_army_manager import TabletopArmyManager

def test_mark_weapon_fired(qtbot):
    """Test marking a weapon as fired."""
    window = TabletopArmyManager()
    qtbot.addWidget(window)
    
    # Add a unit with weapons
    test_data = {
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
                    },
                    {
                        "name": "Plasma Gun",
                        "range": "12",
                        "type": "PISTOL"
                    }
                ]
            }
        ]
    }
    # Create and set army (matching current system)
    from army_document import ArmyDocument
    army = ArmyDocument(test_data)
    window.attacking_army = army
    
    # Test weapon tracking at the data level
    unit = army.units[0]
    weapon1 = unit.weapons[0]
    weapon2 = unit.weapons[1]
    
    # Verify initial weapon status
    assert not weapon1.fired
    assert not weapon2.fired
    
    # Mark first weapon as fired
    weapon1.mark_fired()
    
    # Verify weapon status
    assert weapon1.fired
    assert not weapon2.fired

def test_reset_turn(qtbot):
    """Test resetting weapons for a new turn."""
    window = TabletopArmyManager()
    qtbot.addWidget(window)
    
    # Add a unit with weapons
    test_data = {
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
                    },
                    {
                        "name": "Plasma Gun",
                        "range": "12",
                        "type": "PISTOL"
                    }
                ]
            }
        ]
    }
    # Create and set army (matching current system)
    from army_document import ArmyDocument
    army = ArmyDocument(test_data)
    window.attacking_army = army
    
    # Test weapon tracking at the data level
    unit = army.units[0]
    weapon1 = unit.weapons[0]
    weapon2 = unit.weapons[1]
    
    # Fire both weapons
    weapon1.mark_fired()
    weapon2.mark_fired()
    
    # Verify weapons are fired
    assert weapon1.fired
    assert weapon2.fired
    
    # Reset turn
    army.reset_turn()
    
    # Verify weapons are reset
    assert not weapon1.fired
    assert not weapon2.fired
