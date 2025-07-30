import pytest
from PySide6.QtWidgets import QApplication
from main_window import MainWindow

def test_main_window_creation(qtbot):
    """Test creation of main window."""
    window = MainWindow()
    qtbot.addWidget(window)
    
    assert window.windowTitle() == "Warhammer 40k Army Manager"
    assert window.army_list.count() == 0  # No armies loaded initially

def test_load_army(qtbot):
    """Test loading an army."""
    window = MainWindow()
    qtbot.addWidget(window)
    
    # Simulate loading an army
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
                    }
                ]
            }
        ]
    }
    
    window.load_army(test_data)
    assert window.army_list.count() == 1
    assert window.army_list.item(0).text() == "Test Army"

def test_select_unit(qtbot):
    """Test selecting a unit."""
    window = MainWindow()
    qtbot.addWidget(window)
    
    # Add a unit to the window
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
                    }
                ]
            }
        ]
    }
    window.load_army(test_data)
    
    # Select the unit
    window.army_list.setCurrentRow(0)
    
    # Verify unit details are displayed
    assert window.unit_name.text() == "Test Unit"
    assert window.unit_type.text() == "Type: INFANTRY"
    assert window.unit_models.text() == "Models: 5"
    assert window.unit_wounds.text() == "Wounds: 10"
