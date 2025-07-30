from dataclasses import dataclass
from typing import List, Optional

class TurnTracker:
    def __init__(self):
        self.current_turn = 1
        self.current_phase = "Movement"
        self.phase_order = ["Movement", "Shooting", "Charge", "Combat"]
        self._phase_index = 0

    def advance_phase(self):
        """Advance to the next phase in the turn."""
        self._phase_index = (self._phase_index + 1) % len(self.phase_order)
        self.current_phase = self.phase_order[self._phase_index]
        
        # If we've wrapped around, advance to next turn
        if self._phase_index == 0:
            self.advance_turn()

    def advance_turn(self):
        """Advance to the next turn."""
        self.current_turn += 1
        self._phase_index = 0
        self.current_phase = self.phase_order[0]

    def reset_turn(self):
        """Reset the turn tracker to the beginning."""
        self.current_turn = 1
        self._phase_index = 0
        self.current_phase = self.phase_order[0]

    def get_current_phase(self) -> str:
        """Get the current phase."""
        return self.current_phase

    def get_current_turn(self) -> int:
        """Get the current turn number."""
        return self.current_turn

    def get_next_phase(self) -> str:
        """Get the next phase in the turn."""
        next_index = (self._phase_index + 1) % len(self.phase_order)
        return self.phase_order[next_index]
