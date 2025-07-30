import pytest
from PySide6.QtWidgets import QApplication
from visual_indicators import VisualIndicatorWidget

def test_unit_type_indicator(qtbot):
    """Test unit type indicator display."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Test infantry indicator
    widget.set_unit_type("INFANTRY")
    assert widget.unit_type_label.text() == "Infantry"
    assert widget.unit_type_label.styleSheet() == "color: green"
    
    # Test vehicle indicator
    widget.set_unit_type("VEHICLE")
    assert widget.unit_type_label.text() == "Vehicle"
    assert widget.unit_type_label.styleSheet() == "color: blue"
    
    # Test flyer indicator
    widget.set_unit_type("FLYER")
    assert widget.unit_type_label.text() == "Flyer"
    assert widget.unit_type_label.styleSheet() == "color: purple"

def test_wounds_indicator(qtbot):
    """Test wounds indicator display."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Test full wounds
    widget.set_wounds(10, 10)
    assert widget.wounds_label.text() == "10/10"
    assert widget.wounds_label.styleSheet() == "color: green"
    
    # Test half wounds
    widget.set_wounds(5, 10)
    assert widget.wounds_label.text() == "5/10"
    assert widget.wounds_label.styleSheet() == "color: yellow"
    
    # Test critical wounds
    widget.set_wounds(2, 10)
    assert widget.wounds_label.text() == "2/10"
    assert widget.wounds_label.styleSheet() == "color: red"

def test_status_indicator(qtbot):
    """Test status indicator display."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Test no status
    widget.set_status([])
    assert widget.status_label.text() == ""
    
    # Test single status
    widget.set_status(["Pinned"])
    assert widget.status_label.text() == "Pinned"
    assert widget.status_label.styleSheet() == "color: orange"
    
    # Test multiple statuses
    widget.set_status(["Pinned", "Falling Back"])
    assert widget.status_label.text() == "Pinned, Falling Back"
    assert widget.status_label.styleSheet() == "color: orange"
