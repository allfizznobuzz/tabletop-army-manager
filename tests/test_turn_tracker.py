import pytest
from PySide6.QtWidgets import QApplication
from turn_tracker import TurnTracker

def test_turn_tracker_initial_state():
    """Test initial state of turn tracker."""
    tracker = TurnTracker()
    assert tracker.current_turn == 1
    assert tracker.current_phase == "Movement"
    assert tracker.phase_order == ["Movement", "Shooting", "Charge", "Combat"]

def test_advance_turn():
    """Test advancing to the next turn."""
    tracker = TurnTracker()
    tracker.advance_turn()
    assert tracker.current_turn == 2
    assert tracker.current_phase == "Movement"

def test_advance_phase():
    """Test advancing through phases."""
    tracker = TurnTracker()
    
    # Test advancing through all phases
    for phase in ["Shooting", "Charge", "Combat"]:
        tracker.advance_phase()
        assert tracker.current_phase == phase
    
    # Test wrapping around to next turn
    tracker.advance_phase()
    assert tracker.current_turn == 2
    assert tracker.current_phase == "Movement"

def test_reset_turn():
    """Test resetting the turn."""
    tracker = TurnTracker()
    tracker.advance_turn()
    tracker.advance_phase()
    tracker.advance_phase()
    
    tracker.reset_turn()
    assert tracker.current_turn == 1
    assert tracker.current_phase == "Movement"
