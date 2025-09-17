"""
Unit tests for turn tracker functionality.
"""
import pytest
from turn_tracker import TurnTracker


def test_turn_tracker_initialization():
    """Test turn tracker initializes correctly."""
    tracker = TurnTracker()
    
    assert tracker.current_turn == 1
    assert tracker.current_phase == "Movement"


def test_turn_progression():
    """Test turn and phase progression."""
    tracker = TurnTracker()
    
    # Test phase progression based on actual implementation
    tracker.advance_phase()
    assert tracker.current_phase == "Shooting"
    
    tracker.advance_phase()
    assert tracker.current_phase == "Charge"
    
    tracker.advance_phase()
    assert tracker.current_phase == "Combat"
    
    # Next phase should advance turn
    tracker.advance_phase()
    assert tracker.current_turn == 2
    assert tracker.current_phase == "Movement"


def test_turn_reset():
    """Test turn reset functionality."""
    tracker = TurnTracker()
    
    # Advance several turns
    for _ in range(10):
        tracker.advance_phase()
    
    # Reset
    tracker.reset_turn()
    
    assert tracker.current_turn == 1
    assert tracker.current_phase == "Movement"


def test_phase_names():
    """Test all phase names are correct."""
    tracker = TurnTracker()
    expected_phases = ["Movement", "Shooting", "Charge", "Combat"]
    
    for expected_phase in expected_phases:
        assert tracker.current_phase == expected_phase
        tracker.advance_phase()


def test_get_next_phase():
    """Test getting next phase without advancing."""
    tracker = TurnTracker()
    
    assert tracker.get_next_phase() == "Shooting"
    assert tracker.current_phase == "Movement"  # Should not change
    
    tracker.advance_phase()
    assert tracker.get_next_phase() == "Charge"
