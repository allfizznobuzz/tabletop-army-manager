"""
Smoke tests for application startup and basic functionality.
These tests ensure the core application works and doesn't regress.
"""
import pytest
from PySide6.QtWidgets import QApplication
from tabletop_army_manager import TabletopArmyManager


def test_app_starts_without_error(qtbot):
    """Test that the application starts without crashing."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # App should start and be visible
    assert app.isVisible() is False  # Not shown by default
    app.show()
    assert app.isVisible() is True


def test_window_title_correct(qtbot):
    """Test that window has correct title."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    assert "Tabletop Army Manager" in app.windowTitle()


def test_ui_components_exist(qtbot):
    """Test that essential UI components are created."""
    app = TabletopArmyManager()
    qtbot.addWidget(app)
    
    # Check that main UI sections exist (based on actual codebase)
    assert hasattr(app, 'army_loader')
    assert hasattr(app, 'battlescribe_converter')
    assert hasattr(app, 'target_selector')
    assert hasattr(app, 'turn_tracker')


def test_sample_army_files_exist():
    """Test that sample army files are present and readable."""
    import os
    
    sample_files = [
        "sample-army-BA.json",
        "sample-army-WE.json"
    ]
    
    for filename in sample_files:
        assert os.path.exists(filename), f"Sample file {filename} missing"
        
        # Test file is readable JSON
        import json
        with open(filename, 'r') as f:
            data = json.load(f)
            assert isinstance(data, dict)
            assert 'roster' in data  # BattleScribe format
