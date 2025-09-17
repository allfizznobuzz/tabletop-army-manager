"""
Pytest configuration for tabletop army manager tests.
"""
import sys
import os
import pytest
from PySide6.QtWidgets import QApplication

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

@pytest.fixture(scope="session")
def qapp():
    """Create QApplication instance for GUI tests."""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    yield app
    app.quit()

@pytest.fixture
def qtbot(qapp, qtbot):
    """Enhanced qtbot fixture with app instance."""
    return qtbot
