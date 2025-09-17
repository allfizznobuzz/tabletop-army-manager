import pytest
from PySide6.QtWidgets import QApplication
from tabletop_army_manager import TabletopArmyManager as MainWindow

def test_main_window_creation(qtbot):
    """Test creation of main window."""
    window = MainWindow()
    qtbot.addWidget(window)
    
    assert window.windowTitle() == "Tabletop Army Manager - Combat Assistant"
    # Check that window initializes with required components
    assert hasattr(window, 'army_loader')
    assert hasattr(window, 'attacking_army')
    assert hasattr(window, 'defending_army')

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
    
    # Test that we can create an army document from the data
    from army_document import ArmyDocument
    army = ArmyDocument(test_data)
    
    # Set it as attacking army (this is how the current system works)
    window.attacking_army = army
    
    # Verify army was set
    assert window.attacking_army is not None
    assert window.attacking_army.name == "Test Army"

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
    # Create and set army (matching current system)
    from army_document import ArmyDocument
    army = ArmyDocument(test_data)
    window.attacking_army = army
    
    # Test that we can access unit data
    unit = army.units[0]
    assert unit.name == "Test Unit"
    assert unit.unit_type == "INFANTRY"
    assert unit.models == 5
    assert unit.wounds == 10
