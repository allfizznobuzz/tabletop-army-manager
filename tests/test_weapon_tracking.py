import pytest
from PySide6.QtWidgets import QApplication
from main_window import MainWindow

def test_mark_weapon_fired(qtbot):
    """Test marking a weapon as fired."""
    window = MainWindow()
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
    window.load_army(test_data)
    
    # Select the unit
    window.army_list.setCurrentRow(0)
    
    # Verify initial weapon status
    assert "[Ready]" in window.weapons_list.item(0).text()
    assert "[Ready]" in window.weapons_list.item(1).text()
    
    # Mark first weapon as fired
    window.weapons_list.item(0).setSelected(True)
    window.mark_weapon_fired()
    
    # Verify weapon status
    assert "[Fired]" in window.weapons_list.item(0).text()
    assert "[Ready]" in window.weapons_list.item(1).text()

def test_reset_turn(qtbot):
    """Test resetting weapons for a new turn."""
    window = MainWindow()
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
    window.load_army(test_data)
    
    # Select the unit
    window.army_list.setCurrentRow(0)
    
    # Fire both weapons
    window.weapons_list.item(0).setSelected(True)
    window.mark_weapon_fired()
    window.weapons_list.item(1).setSelected(True)
    window.mark_weapon_fired()
    
    # Verify weapons are fired
    assert "[Fired]" in window.weapons_list.item(0).text()
    assert "[Fired]" in window.weapons_list.item(1).text()
    
    # Reset turn
    window.reset_turn()
    
    # Verify weapons are reset
    assert "[Ready]" in window.weapons_list.item(0).text()
    assert "[Ready]" in window.weapons_list.item(1).text()
