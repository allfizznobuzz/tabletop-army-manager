"""
Test coverage for remove army functionality.

This module tests the remove army buttons and their effects on the application state.
"""

import pytest
from unittest.mock import patch, MagicMock
from tabletop_army_manager import TabletopArmyManager
from army_document import ArmyDocument


@pytest.fixture
def sample_army_data():
    """Sample army data for testing."""
    return {
        "name": "Test Army",
        "units": [
            {
                "name": "Test Unit",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 2,
                "weapons": [
                    {
                        "name": "Test Weapon",
                        "range": "24\"",
                        "type": "Rapid Fire 1",
                        "attacks": "1",
                        "skill": 3,
                        "strength": 4,
                        "ap": 0,
                        "damage": "1"
                    }
                ]
            }
        ]
    }


def test_remove_attacking_army_clears_state(qtbot, sample_army_data):
    """Test that removing attacking army clears all related state."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Load an army first
    army = ArmyDocument(sample_army_data)
    app.attacking_army = army
    app.current_attacking_unit = army.units[0]
    app.selected_weapon = army.units[0].weapons[0]
    app.target_selector.attacking_army = army
    
    # Update UI to reflect loaded state
    app.attacking_army_label.setText(f"✅ Loaded: {army.name}")
    app.attacking_army_label.setStyleSheet("color: #00ff00;")
    app.populate_attacking_units()
    app.fire_weapon_btn.setEnabled(True)
    
    # Verify army is loaded
    assert app.attacking_army is not None
    assert app.current_attacking_unit is not None
    assert app.selected_weapon is not None
    assert app.attacking_units_list.count() > 0
    
    # Remove the army
    app.remove_attacking_army()
    
    # Verify all state is cleared
    assert app.attacking_army is None
    assert app.current_attacking_unit is None
    assert app.selected_weapon is None
    assert app.attacking_army_label.text() == "No army loaded"
    assert "color: #888888; font-style: italic;" in app.attacking_army_label.styleSheet()
    assert app.attacking_units_list.count() == 0
    assert app.attacking_weapons_list.count() == 0
    assert app.attacking_unit_name.text() == "No unit selected"
    assert app.attacking_unit_stats.text() == ""
    assert not app.fire_weapon_btn.isEnabled()
    assert app.target_selector.attacking_army is None


def test_remove_defending_army_clears_state(qtbot, sample_army_data):
    """Test that removing defending army clears all related state."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Load an army first
    army = ArmyDocument(sample_army_data)
    app.defending_army = army
    app.current_defending_unit = army.units[0]
    app.target_selector.defending_army = army
    
    # Update UI to reflect loaded state
    app.defending_army_label.setText(f"✅ Loaded: {army.name}")
    app.defending_army_label.setStyleSheet("color: #00ff00;")
    app.populate_defending_units()
    
    # Verify army is loaded
    assert app.defending_army is not None
    assert app.current_defending_unit is not None
    assert app.defending_units_list.count() > 0
    
    # Remove the army
    app.remove_defending_army()
    
    # Verify all state is cleared
    assert app.defending_army is None
    assert app.current_defending_unit is None
    assert app.defending_army_label.text() == "No army loaded"
    assert "color: #888888; font-style: italic;" in app.defending_army_label.styleSheet()
    assert app.defending_units_list.count() == 0
    assert app.defending_unit_name.text() == "No target selected"
    assert app.defending_unit_stats.text() == ""
    assert app.target_selector.defending_army is None


def test_remove_army_triggers_auto_calculation(qtbot, sample_army_data):
    """Test that removing armies triggers auto-calculation to update combat display."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Mock the trigger_auto_calculation method
    with patch.object(app, 'trigger_auto_calculation') as mock_calc:
        # Remove attacking army
        app.remove_attacking_army()
        mock_calc.assert_called_once()
        
        mock_calc.reset_mock()
        
        # Remove defending army
        app.remove_defending_army()
        mock_calc.assert_called_once()


def test_remove_army_when_no_army_loaded(qtbot):
    """Test that removing army when none is loaded doesn't cause errors."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Verify initial state
    assert app.attacking_army is None
    assert app.defending_army is None
    
    # Remove armies when none are loaded - should not crash
    app.remove_attacking_army()
    app.remove_defending_army()
    
    # Verify state remains consistent
    assert app.attacking_army is None
    assert app.defending_army is None
    assert app.attacking_army_label.text() == "No army loaded"
    assert app.defending_army_label.text() == "No army loaded"


def test_remove_army_buttons_exist(qtbot):
    """Test that remove army buttons are present in the UI."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Find remove buttons by their text
    attacking_remove_btn = None
    defending_remove_btn = None
    
    # Search through all QPushButton widgets
    from PySide6.QtWidgets import QPushButton
    for widget in app.findChildren(QPushButton):
        if "🗑️ Remove Army" in widget.text():
            if attacking_remove_btn is None:
                attacking_remove_btn = widget
            else:
                defending_remove_btn = widget
    
    assert attacking_remove_btn is not None, "Attacking remove army button not found"
    assert defending_remove_btn is not None, "Defending remove army button not found"


def test_remove_army_button_functionality(qtbot, sample_army_data):
    """Test that clicking remove army buttons actually removes armies."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Load armies
    army = ArmyDocument(sample_army_data)
    app.attacking_army = army
    app.defending_army = army
    app.populate_attacking_units()
    app.populate_defending_units()
    
    # Verify armies are loaded
    assert app.attacking_army is not None
    assert app.defending_army is not None
    assert app.attacking_units_list.count() > 0
    assert app.defending_units_list.count() > 0
    
    # Find and click remove buttons
    from PySide6.QtWidgets import QPushButton
    remove_buttons = []
    for widget in app.findChildren(QPushButton):
        if "🗑️ Remove Army" in widget.text():
            remove_buttons.append(widget)
    
    assert len(remove_buttons) == 2, "Should have exactly 2 remove army buttons"
    
    # Click first remove button (attacking)
    from PySide6.QtCore import Qt
    qtbot.mouseClick(remove_buttons[0], Qt.LeftButton)
    
    # Click second remove button (defending)  
    qtbot.mouseClick(remove_buttons[1], Qt.LeftButton)
    
    # Verify armies are removed
    assert app.attacking_army is None
    assert app.defending_army is None
    assert app.attacking_units_list.count() == 0
    assert app.defending_units_list.count() == 0


def test_remove_army_preserves_other_state(qtbot, sample_army_data):
    """Test that removing one army doesn't affect the other army's state."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Load both armies
    attacking_army = ArmyDocument(sample_army_data)
    defending_army = ArmyDocument({
        "name": "Defending Army",
        "units": [
            {
                "name": "Defender Unit",
                "type": "VEHICLE",
                "models": 1,
                "wounds": 8,
                "weapons": []
            }
        ]
    })
    
    app.attacking_army = attacking_army
    app.defending_army = defending_army
    app.populate_attacking_units()
    app.populate_defending_units()
    
    # Verify both armies are loaded
    assert app.attacking_army is not None
    assert app.defending_army is not None
    assert app.attacking_units_list.count() > 0
    assert app.defending_units_list.count() > 0
    
    # Remove only attacking army
    app.remove_attacking_army()
    
    # Verify attacking army is removed but defending army remains
    assert app.attacking_army is None
    assert app.defending_army is not None
    assert app.attacking_units_list.count() == 0
    assert app.defending_units_list.count() > 0
    assert app.defending_army.name == "Defending Army"
    
    # Remove defending army
    app.remove_defending_army()
    
    # Verify defending army is now also removed
    assert app.attacking_army is None
    assert app.defending_army is None
    assert app.attacking_units_list.count() == 0
    assert app.defending_units_list.count() == 0
