"""
Unit tests for visual indicators functionality.
"""
import pytest
from PySide6.QtGui import QColor
from visual_indicators import VisualIndicatorWidget


def test_visual_indicator_widget_initialization(qtbot):
    """Test visual indicator widget initializes correctly."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Check that all components exist
    assert hasattr(widget, 'unit_type_label')
    assert hasattr(widget, 'wounds_label')
    assert hasattr(widget, 'status_label')


def test_unit_type_setting(qtbot):
    """Test setting unit type indicators."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Test infantry type
    widget.set_unit_type("INFANTRY")
    assert "Infantry" in widget.unit_type_label.text()
    
    # Test vehicle type
    widget.set_unit_type("VEHICLE")
    assert "Vehicle" in widget.unit_type_label.text()
    
    # Test unknown type
    widget.set_unit_type("UNKNOWN")
    assert "UNKNOWN" in widget.unit_type_label.text()


def test_wounds_setting(qtbot):
    """Test setting wound indicators."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Test full health
    widget.set_wounds(10, 10)
    assert "10/10" in widget.wounds_label.text()
    
    # Test partial wounds
    widget.set_wounds(5, 10)
    assert "5/10" in widget.wounds_label.text()
    
    # Test critical wounds
    widget.set_wounds(1, 10)
    assert "1/10" in widget.wounds_label.text()


def test_status_setting(qtbot):
    """Test setting status indicators."""
    widget = VisualIndicatorWidget()
    qtbot.addWidget(widget)
    
    # Test empty status
    widget.set_status([])
    assert widget.status_label.text() == ""
    
    # Test single status
    widget.set_status(["Engaged"])
    assert "Engaged" in widget.status_label.text()
    
    # Test multiple statuses
    widget.set_status(["Engaged", "Wounded"])
    assert "Engaged, Wounded" in widget.status_label.text()
