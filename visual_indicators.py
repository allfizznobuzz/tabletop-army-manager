from PySide6.QtWidgets import (QWidget, QLabel, QHBoxLayout, 
                               QFrame, QVBoxLayout)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

class VisualIndicatorWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.setup_ui()
        
    def setup_ui(self):
        """Set up the visual indicators UI."""
        layout = QVBoxLayout()
        self.setLayout(layout)
        
        # Unit Type Indicator
        self.unit_type_frame = QFrame()
        self.unit_type_frame.setFrameStyle(QFrame.StyledPanel | QFrame.Raised)
        unit_type_layout = QHBoxLayout()
        self.unit_type_frame.setLayout(unit_type_layout)
        
        self.unit_type_label = QLabel("Type:")
        self.unit_type_label.setAlignment(Qt.AlignCenter)
        unit_type_layout.addWidget(self.unit_type_label)
        layout.addWidget(self.unit_type_frame)
        
        # Wounds Indicator
        self.wounds_frame = QFrame()
        self.wounds_frame.setFrameStyle(QFrame.StyledPanel | QFrame.Raised)
        wounds_layout = QHBoxLayout()
        self.wounds_frame.setLayout(wounds_layout)
        
        self.wounds_label = QLabel("Wounds: 0/0")
        self.wounds_label.setAlignment(Qt.AlignCenter)
        wounds_layout.addWidget(self.wounds_label)
        layout.addWidget(self.wounds_frame)
        
        # Status Indicator
        self.status_frame = QFrame()
        self.status_frame.setFrameStyle(QFrame.StyledPanel | QFrame.Raised)
        status_layout = QHBoxLayout()
        self.status_frame.setLayout(status_layout)
        
        self.status_label = QLabel("")
        self.status_label.setAlignment(Qt.AlignCenter)
        status_layout.addWidget(self.status_label)
        layout.addWidget(self.status_frame)
        
        # Set default styles
        self.unit_type_label.setFont(QFont("Arial", 12, QFont.Bold))
        self.wounds_label.setFont(QFont("Arial", 12, QFont.Bold))
        self.status_label.setFont(QFont("Arial", 12, QFont.Bold))
        
    def set_unit_type(self, unit_type: str):
        """Set the unit type indicator."""
        type_map = {
            "INFANTRY": ("Infantry", "green"),
            "VEHICLE": ("Vehicle", "blue"),
            "FLYER": ("Flyer", "purple"),
            "MONSTER": ("Monster", "orange"),
            "CHARACTER": ("Character", "brown"),
            "HQ": ("HQ", "gold")
        }
        
        display_text, color = type_map.get(unit_type, (unit_type, "black"))
        self.unit_type_label.setText(f"Type: {display_text}")
        self.unit_type_label.setStyleSheet(f"color: {color}")
        
    def set_wounds(self, current: int, max_wounds: int):
        """Set the wounds indicator."""
        self.wounds_label.setText(f"Wounds: {current}/{max_wounds}")
        
        # Set color based on wounds remaining
        if current == max_wounds:
            self.wounds_label.setStyleSheet("color: green")
        elif current > max_wounds / 2:
            self.wounds_label.setStyleSheet("color: yellow")
        else:
            self.wounds_label.setStyleSheet("color: red")
            
    def set_status(self, statuses: list[str]):
        """Set the status indicator."""
        if not statuses:
            self.status_label.setText("")
            self.status_label.setStyleSheet("color: black")
            return
            
        # Join statuses with comma
        status_text = ", ".join(statuses)
        self.status_label.setText(f"Status: {status_text}")
        self.status_label.setStyleSheet("color: orange")
