"""
Tabletop Army Manager - Generic Miniature Game Combat Assistant
Features:
- Robust JSON ingestion with BattleScribe support
- Beautiful dice roll visuals with custom graphics
- Instant calculation when weapon + target selected
- Total dice calculation based on attacks and models
- Dark theme and improved UX
"""

# Standard library imports
import json
import math
import os
import random
import re

# Third-party imports
from PySide6.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QTransform
from PySide6.QtWidgets import (
    QFileDialog, QGroupBox, QHBoxLayout, QLabel, QListWidget,
    QMainWindow, QMessageBox, QPushButton, QTextEdit, QVBoxLayout, QWidget
)

# Local imports
from army_loader import ArmyLoader
from battlescribe_converter import BattleScribeConverter
from combat_mechanics import CombatCalculator, TargetSelector
from turn_tracker import TurnTracker
from visual_indicators import VisualIndicatorWidget


class StaticDiceWidget(QWidget):
    """Small, static dice widget for displaying results."""
    
    DICE_SIZE = 35  # Smaller for results grid
    
    def __init__(self, value=1, parent=None):
        """Initialize static dice with a specific value."""
        super().__init__(parent)
        self.setFixedSize(self.DICE_SIZE + 4, self.DICE_SIZE + 4)
        self.value = value
        self.is_success = False  # Whether this roll meets the threshold
    
    def set_value(self, value, is_success=False):
        """Set the dice value and success status."""
        self.value = value
        self.is_success = is_success
        self.update()
    
    def paintEvent(self, event):
        """Paint the static dice."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Choose colors based on success/failure
        if self.is_success:
            bg_color = QColor(200, 255, 200)  # Light green for success
            border_color = QColor(100, 200, 100)  # Green border
        else:
            bg_color = QColor(255, 200, 200)  # Light red for failure
            border_color = QColor(200, 100, 100)  # Red border
        
        # Draw dice background
        painter.setBrush(bg_color)
        painter.setPen(border_color)
        painter.drawRoundedRect(2, 2, self.DICE_SIZE, self.DICE_SIZE, 4, 4)
        
        # Draw dice dots
        self._draw_dice_dots(painter)
    
    def _draw_dice_dots(self, painter):
        """Draw dots on the dice face."""
        painter.setBrush(QColor(50, 50, 50))
        painter.setPen(Qt.NoPen)
        
        dot_size = 4
        margin = 8
        center = self.DICE_SIZE // 2 + 2
        
        # Dot positions (adjusted for smaller dice)
        positions = {
            'top_left': (margin, margin),
            'top_right': (self.DICE_SIZE - margin - dot_size + 2, margin),
            'center_left': (margin, center - dot_size//2),
            'center': (center - dot_size//2, center - dot_size//2),
            'center_right': (self.DICE_SIZE - margin - dot_size + 2, center - dot_size//2),
            'bottom_left': (margin, self.DICE_SIZE - margin - dot_size + 2),
            'bottom_right': (self.DICE_SIZE - margin - dot_size + 2, self.DICE_SIZE - margin - dot_size + 2)
        }
        
        # Draw dots based on dice value
        dots_to_draw = []
        
        if self.value == 1:
            dots_to_draw = ['center']
        elif self.value == 2:
            dots_to_draw = ['top_left', 'bottom_right']
        elif self.value == 3:
            dots_to_draw = ['top_left', 'center', 'bottom_right']
        elif self.value == 4:
            dots_to_draw = ['top_left', 'top_right', 'bottom_left', 'bottom_right']
        elif self.value == 5:
            dots_to_draw = ['top_left', 'top_right', 'center', 'bottom_left', 'bottom_right']
        elif self.value == 6:
            dots_to_draw = ['top_left', 'top_right', 'center_left', 'center_right', 'bottom_left', 'bottom_right']
        
        # Draw the dots
        for dot in dots_to_draw:
            if dot in positions:
                x, y = positions[dot]
                painter.drawEllipse(x, y, dot_size, dot_size)


class AnimatedDiceWidget(QWidget):
    """Animated dice widget that shows rolling animations."""
    
    # Animation constants
    DICE_SIZE = 80  # Larger dice for better visibility
    ANIMATION_DURATION = 2000  # Longer animation for more realism
    ROLL_FRAMES = 30  # More frames for smoother animation
    
    def __init__(self, parent=None):
        """Initialize the animated dice widget."""
        super().__init__(parent)
        self.setFixedSize(self.DICE_SIZE + 10, self.DICE_SIZE + 10)
        
        # Animation state
        self.is_rolling = False
        self.current_value = 1
        self.target_value = 1
        self.rotation_angle = 0
        self.rotation_x = 0  # 3D rotation effect
        self.rotation_y = 0
        self.bounce_offset = 0
        self.scale_factor = 1.0  # Scale effect during animation
        self.shadow_offset = 5  # Shadow depth
        
        # Animation timers
        self.roll_timer = QTimer()
        self.roll_timer.timeout.connect(self._update_animation)
        
        # Animation properties
        self.animation_frame = 0
        self.max_frames = self.ROLL_FRAMES
    
    def roll_dice(self, target_value):
        """Start rolling animation to target value."""
        if self.is_rolling:
            return
        
        self.is_rolling = True
        self.target_value = target_value
        self.animation_frame = 0
        
        # Start animation timer (60 FPS)
        self.roll_timer.start(25)  # ~40 FPS for smooth animation
    
    def _update_animation(self):
        """Update animation frame."""
        self.animation_frame += 1
        
        # Calculate animation progress (0.0 to 1.0)
        progress = self.animation_frame / self.max_frames
        
        if progress >= 1.0:
            # Animation complete
            self._finish_animation()
        else:
            # Update animation values
            self._update_animation_values(progress)
        
        self.update()  # Trigger repaint
    
    def _update_animation_values(self, progress):
        """Update animation values based on progress."""
        # Multiple rotation axes for 3D effect
        self.rotation_angle = progress * 900 + (random.randint(0, 180))
        self.rotation_x = progress * 540 + (random.randint(0, 90))
        self.rotation_y = progress * 720 + (random.randint(0, 120))
        
        # Enhanced bounce with gravity simulation
        gravity_effect = 1 - (progress * progress)  # Quadratic easing
        bounce_intensity = 30 * gravity_effect * abs(math.sin(progress * math.pi * 6))
        self.bounce_offset = bounce_intensity
        
        # Scale effect - dice "squash" on impact
        if progress > 0.8:  # Near end of animation
            impact_factor = (1 - progress) * 5  # Stronger effect near end
            self.scale_factor = 1.0 + 0.2 * abs(math.sin(impact_factor * math.pi))
        else:
            self.scale_factor = 1.0 + 0.1 * abs(math.sin(progress * math.pi * 3))
        
        # Shadow depth changes with bounce
        self.shadow_offset = 5 + (self.bounce_offset * 0.3)
        
        # More frequent face changes for realism
        if random.random() < 0.4:  # 40% chance to change face
            self.current_value = random.randint(1, 6)
    
    def _finish_animation(self):
        """Finish the rolling animation."""
        self.roll_timer.stop()
        self.is_rolling = False
        self.current_value = self.target_value
        self.rotation_angle = 0
        self.bounce_offset = 0
        self.update()
    
    def paintEvent(self, event):
        """Paint the animated dice with 3D effects and shadows."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Calculate dice position
        center_x = self.width() // 2
        center_y = self.height() // 2 + self.bounce_offset
        
        # Draw shadow first (behind the dice)
        self._draw_shadow(painter, center_x, center_y)
        
        # Save painter state for transformations
        painter.save()
        
        # Apply transformations
        painter.translate(center_x, center_y)
        
        # Apply scaling
        painter.scale(self.scale_factor, self.scale_factor)
        
        # Apply rotations for 3D effect
        if self.is_rolling:
            painter.rotate(self.rotation_angle)
            # Simulate 3D by skewing based on rotation_x and rotation_y
            skew_x = math.sin(math.radians(self.rotation_x)) * 0.3
            skew_y = math.sin(math.radians(self.rotation_y)) * 0.2
            transform = QTransform(1, skew_y, skew_x, 1, 0, 0)
            painter.setTransform(transform, True)
        
        # Center the dice
        painter.translate(-self.DICE_SIZE//2, -self.DICE_SIZE//2)
        
        # Draw dice with gradient effect
        self._draw_dice_with_gradient(painter)
        
        # Draw dice dots
        self._draw_dice_dots(painter)
        
        # Restore painter state
        painter.restore()
    
    def _draw_dice_dots(self, painter):
        """Draw dots on the dice face."""
        painter.setBrush(QColor(50, 50, 50))
        painter.setPen(Qt.NoPen)
        
        dot_size = 8
        margin = 12
        center = self.DICE_SIZE // 2
        
        # Dot positions
        positions = {
            'top_left': (margin, margin),
            'top_right': (self.DICE_SIZE - margin - dot_size, margin),
            'center_left': (margin, center - dot_size//2),
            'center': (center - dot_size//2, center - dot_size//2),
            'center_right': (self.DICE_SIZE - margin - dot_size, center - dot_size//2),
            'bottom_left': (margin, self.DICE_SIZE - margin - dot_size),
            'bottom_right': (self.DICE_SIZE - margin - dot_size, self.DICE_SIZE - margin - dot_size)
        }
        
        # Draw dots based on dice value
        dots_to_draw = []
        
        if self.current_value == 1:
            dots_to_draw = ['center']
        elif self.current_value == 2:
            dots_to_draw = ['top_left', 'bottom_right']
        elif self.current_value == 3:
            dots_to_draw = ['top_left', 'center', 'bottom_right']
        elif self.current_value == 4:
            dots_to_draw = ['top_left', 'top_right', 'bottom_left', 'bottom_right']
        elif self.current_value == 5:
            dots_to_draw = ['top_left', 'top_right', 'center', 'bottom_left', 'bottom_right']
        elif self.current_value == 6:
            dots_to_draw = ['top_left', 'top_right', 'center_left', 'center_right', 'bottom_left', 'bottom_right']
        
        # Draw the dots
        for dot in dots_to_draw:
            if dot in positions:
                x, y = positions[dot]
                painter.drawEllipse(x, y, dot_size, dot_size)
    
    def _draw_shadow(self, painter, center_x, center_y):
        """Draw a shadow behind the dice."""
        shadow_size = self.DICE_SIZE * self.scale_factor
        shadow_x = center_x - shadow_size//2 + self.shadow_offset
        shadow_y = center_y - shadow_size//2 + self.shadow_offset + self.bounce_offset
        
        # Create shadow color (semi-transparent black)
        shadow_color = QColor(0, 0, 0, 60)  # Alpha for transparency
        painter.setBrush(shadow_color)
        painter.setPen(Qt.NoPen)
        
        # Draw elliptical shadow (more realistic)
        painter.drawEllipse(int(shadow_x), int(shadow_y), int(shadow_size * 0.8), int(shadow_size * 0.4))
    
    def _draw_dice_with_gradient(self, painter):
        """Draw dice with gradient effect for 3D appearance."""
        from PySide6.QtGui import QLinearGradient
        
        # Create gradient for 3D effect
        gradient = QLinearGradient(0, 0, self.DICE_SIZE, self.DICE_SIZE)
        
        if self.is_rolling:
            # Bright colors while rolling
            gradient.setColorAt(0, QColor(255, 255, 220))  # Light yellow-white
            gradient.setColorAt(0.5, QColor(250, 250, 200))  # Medium yellow
            gradient.setColorAt(1, QColor(240, 240, 180))  # Darker yellow
        else:
            # Normal dice colors
            gradient.setColorAt(0, QColor(250, 250, 250))  # Light white
            gradient.setColorAt(0.5, QColor(240, 240, 240))  # Medium white
            gradient.setColorAt(1, QColor(220, 220, 220))  # Darker white
        
        painter.setBrush(gradient)
        painter.setPen(QColor(100, 100, 100, 150))  # Semi-transparent border
        painter.drawRoundedRect(0, 0, self.DICE_SIZE, self.DICE_SIZE, 10, 10)


class DiceVisualWidget(QWidget):
    """Custom widget for displaying dice roll requirements with visual dice.
    
    This widget renders a visual representation of dice rolls required for
    hit, wound, save, and invulnerable save rolls, along with the total
    number of dice to roll.
    """
    
    # Visual constants
    DICE_WIDTH = 80
    DICE_HEIGHT = 50
    DICE_SPACING = 20
    WIDGET_HEIGHT = 140
    
    # Color scheme for dice (accessible colors with good contrast)
    DICE_COLORS = {
        'hit': QColor(74, 144, 226),      # Professional blue
        'wound': QColor(220, 85, 85),     # Softer red
        'save': QColor(85, 170, 85),      # Muted green
        'invuln': QColor(200, 165, 75),   # Warm gold
        'inactive': QColor(80, 80, 80),   # Gray for unavailable
        'background': QColor(30, 30, 30), # Dark background
        'text': QColor(229, 229, 229),    # Softer white text
    }
    
    def __init__(self):
        """Initialize the dice visual widget."""
        super().__init__()
        self._reset_dice_values()
        self.setMinimumHeight(self.WIDGET_HEIGHT)
    
    def _reset_dice_values(self):
        """Reset all dice values to default (no roll required)."""
        self.hit_roll = 7
        self.wound_roll = 7
        self.save_roll = 7
        self.invuln_roll = 7
        self.total_dice = 0
        
    def set_dice_rolls(self, hit_roll, wound_roll, save_roll, invuln_roll, total_dice=0):
        """Update the dice roll values and total dice count"""
        self.hit_roll = hit_roll
        self.wound_roll = wound_roll
        self.save_roll = save_roll
        self.invuln_roll = invuln_roll
        self.total_dice = total_dice
        self.update()  # Trigger repaint
        
    def paintEvent(self, event):
        """Custom paint event to draw dice visuals."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Draw background
        painter.fillRect(self.rect(), self.DICE_COLORS['background'])
        
        # Draw total dice count at top
        self._draw_dice_count(painter)
        
        # Draw individual dice
        self._draw_dice_row(painter)
    
    def _draw_dice_count(self, painter):
        """Draw the total dice count at the top of the widget."""
        if self.total_dice > 0:
            painter.setPen(self.DICE_COLORS['text'])
            painter.setFont(QFont("Arial", 12, QFont.Weight.DemiBold))
            painter.drawText(10, 20, f"🎲 TOTAL DICE TO ROLL: {self.total_dice}")
    
    def _draw_dice_row(self, painter):
        """Draw the row of dice showing required rolls."""
        dice_data = [
            ("HIT", self.hit_roll, 'hit'),
            ("WOUND", self.wound_roll, 'wound'),
            ("SAVE", self.save_roll, 'save'),
            ("INVULN", self.invuln_roll, 'invuln')
        ]
        
        start_x = 10
        y = 50
        
        for i, (label, roll_value, color_key) in enumerate(dice_data):
            x = start_x + i * (self.DICE_WIDTH + self.DICE_SPACING)
            self._draw_single_die(painter, x, y, label, roll_value, color_key)
    
    def _draw_single_die(self, painter, x, y, label, roll_value, color_key):
        """Draw a single die with label and value."""
        # Determine colors based on whether roll is available
        if roll_value <= 6:
            die_color = self.DICE_COLORS[color_key]
            text_color = QColor(255, 255, 255)
        else:
            die_color = self.DICE_COLORS['inactive']
            text_color = QColor(150, 150, 150)
        
        # Draw die background
        painter.setBrush(die_color)
        painter.setPen(text_color)
        painter.drawRoundedRect(x, y, self.DICE_WIDTH, self.DICE_HEIGHT, 8, 8)
        
        # Draw label above die
        painter.setPen(QColor(255, 255, 255))
        painter.setFont(QFont("Arial", 8, QFont.Bold))
        painter.drawText(x, y - 5, self.DICE_WIDTH, 15, Qt.AlignCenter, label)
        
        # Draw dice value
        painter.setPen(text_color)
        if roll_value <= 6:
            painter.setFont(QFont("Arial", 16, QFont.Bold))
            painter.drawText(x, y, self.DICE_WIDTH, self.DICE_HEIGHT, Qt.AlignCenter, f"{roll_value}+")
        else:
            painter.setFont(QFont("Arial", 10))
            painter.drawText(x, y, self.DICE_WIDTH, self.DICE_HEIGHT, Qt.AlignCenter, "N/A")


class TabletopArmyManager(QMainWindow):
    """Main application window for the Tabletop Army Manager.
    
    This application provides a generic tabletop miniature game combat assistant
    with features including:
    - Army document loading (standard JSON and BattleScribe formats)
    - Unit and weapon selection interface
    - Instant combat dice calculation
    - Visual dice roll displays
    - Turn and phase tracking
    """
    
    # Application constants
    WINDOW_TITLE = "Tabletop Army Manager - Combat Assistant"
    DEFAULT_GEOMETRY = (100, 100, 1600, 1000)
    AUTO_CALC_DELAY_MS = 500  # Delay before auto-calculating combat
    
    def __init__(self):
        """Initialize the main application window."""
        super().__init__()
        self.setWindowTitle(self.WINDOW_TITLE)
        self.setGeometry(*self.DEFAULT_GEOMETRY)
        
        # Data management
        self.army_loader = ArmyLoader()
        self.battlescribe_converter = BattleScribeConverter()
        self.attacking_army = None
        self.defending_army = None
        self.current_attacking_unit = None
        self.current_defending_unit = None
        self.selected_weapon = None
        self.current_dice_result = None
        self.turn_tracker = TurnTracker()
        self.target_selector = TargetSelector()
        
        # Auto-calculation timer
        self.calculation_timer = QTimer()
        self.calculation_timer.setSingleShot(True)
        self.calculation_timer.timeout.connect(self.auto_calculate_combat)
        
        self.setup_ui()
        self.apply_dark_theme()
        
    def apply_dark_theme(self):
        """Apply a professional, accessible dark theme following UI best practices"""
        self.setStyleSheet("""
        QMainWindow {
            background-color: #1e1e1e;
            color: #e5e5e5;
        }
        QGroupBox {
            font-weight: 600;
            border: 1px solid #404040;
            border-radius: 6px;
            margin-top: 12px;
            padding-top: 12px;
            background-color: #252525;
            color: #e5e5e5;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 12px;
            padding: 0 8px 0 8px;
            color: #f0f0f0;
            font-weight: 600;
        }
        QListWidget {
            background-color: #2a2a2a;
            border: 1px solid #404040;
            border-radius: 4px;
            color: #e5e5e5;
            selection-background-color: #3a3a3a;
            padding: 4px;
        }
        QListWidget::item {
            padding: 6px;
            border-radius: 3px;
            margin: 1px;
        }
        QListWidget::item:selected {
            background-color: #4a90e2;
            color: #ffffff;
        }
        QListWidget::item:hover {
            background-color: #353535;
        }
        QPushButton {
            background-color: #4a90e2;
            border: none;
            padding: 10px 16px;
            border-radius: 5px;
            color: #ffffff;
            font-weight: 500;
            min-height: 16px;
        }
        QPushButton:hover {
            background-color: #5ba0f2;
        }
        QPushButton:pressed {
            background-color: #3a80d2;
        }
        QPushButton:disabled {
            background-color: #404040;
            color: #888888;
        }
        QLabel {
            color: #e5e5e5;
        }
        QTextEdit {
            background-color: #2a2a2a;
            border: 1px solid #404040;
            border-radius: 4px;
            color: #e5e5e5;
            padding: 8px;
            selection-background-color: #4a90e2;
            selection-color: #ffffff;
        }
        QFrame {
            background-color: #252525;
            border: 1px solid #404040;
            border-radius: 4px;
        }
    """)
        
    def setup_ui(self):
        """Set up the enhanced UI"""
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        
        # Main layout
        main_layout = QVBoxLayout()
        main_widget.setLayout(main_layout)
        
        # Title
        title = QLabel("🎯 TABLETOP ARMY MANAGER - COMBAT ASSISTANT")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setStyleSheet("color: #0078d4; margin: 10px;")
        main_layout.addWidget(title)
        
        # Main content area
        content_layout = QHBoxLayout()
        main_layout.addLayout(content_layout)
        
        # Create sections
        attacking_section = self.create_attacking_section()
        combat_section = self.create_combat_section()
        defending_section = self.create_defending_section()
        
        content_layout.addWidget(attacking_section, 1)
        content_layout.addWidget(combat_section, 1)
        content_layout.addWidget(defending_section, 1)
        
    def create_attacking_section(self):
        """Create the attacking army section"""
        group = QGroupBox("⚔️ ATTACKING FORCE")
        layout = QVBoxLayout()
        
        # Army loading with auto-conversion
        load_layout = QHBoxLayout()
        load_btn = QPushButton("📁 Load Army (JSON)")
        load_btn.clicked.connect(self.load_attacking_army)
        
        load_layout.addWidget(load_btn)
        layout.addLayout(load_layout)
        
        self.attacking_army_label = QLabel("No army loaded")
        self.attacking_army_label.setStyleSheet("color: #888888; font-style: italic;")
        layout.addWidget(self.attacking_army_label)
        
        # Unit list
        layout.addWidget(QLabel("🪖 Units:"))
        self.attacking_units_list = QListWidget()
        self.attacking_units_list.itemClicked.connect(self.select_attacking_unit)
        layout.addWidget(self.attacking_units_list)
        
        # Selected unit info
        unit_info_group = QGroupBox("Selected Unit")
        unit_info_layout = QVBoxLayout()
        
        self.attacking_unit_name = QLabel("No unit selected")
        self.attacking_unit_stats = QLabel("")
        unit_info_layout.addWidget(self.attacking_unit_name)
        unit_info_layout.addWidget(self.attacking_unit_stats)
        
        # Weapons list
        unit_info_layout.addWidget(QLabel("🔫 Weapons:"))
        self.attacking_weapons_list = QListWidget()
        self.attacking_weapons_list.itemClicked.connect(self.select_weapon)
        unit_info_layout.addWidget(self.attacking_weapons_list)
        
        # Fire weapon button
        self.fire_weapon_btn = QPushButton("🔥 Fire Selected Weapon")
        self.fire_weapon_btn.clicked.connect(self.fire_weapon)
        self.fire_weapon_btn.setEnabled(False)
        unit_info_layout.addWidget(self.fire_weapon_btn)
        
        unit_info_group.setLayout(unit_info_layout)
        layout.addWidget(unit_info_group)
        
        group.setLayout(layout)
        return group
        
    def create_combat_section(self):
        """Create the central combat section with enhanced visuals"""
        group = QGroupBox("🎲 COMBAT RESOLUTION")
        layout = QVBoxLayout()
        
        # Turn tracker
        turn_group = QGroupBox("Turn Tracker")
        turn_layout = QVBoxLayout()
        
        self.turn_label = QLabel("Turn 1 - Movement Phase")
        self.turn_label.setAlignment(Qt.AlignCenter)
        self.turn_label.setFont(QFont("Arial", 12, QFont.Bold))
        turn_layout.addWidget(self.turn_label)
        
        turn_buttons = QHBoxLayout()
        next_phase_btn = QPushButton("⏭️ Next Phase")
        next_phase_btn.clicked.connect(self.next_phase)
        reset_turn_btn = QPushButton("🔄 Reset Turn")
        reset_turn_btn.clicked.connect(self.reset_turn)
        
        turn_buttons.addWidget(next_phase_btn)
        turn_buttons.addWidget(reset_turn_btn)
        turn_layout.addLayout(turn_buttons)
        
        turn_group.setLayout(turn_layout)
        layout.addWidget(turn_group)
        
        # Combat status
        self.combat_status = QLabel("Select weapon and target for instant calculation")
        self.combat_status.setAlignment(Qt.AlignCenter)
        self.combat_status.setStyleSheet("color: #888888; font-style: italic; margin: 10px;")
        layout.addWidget(self.combat_status)
        
        # Enhanced dice visual widget
        dice_group = QGroupBox("Dice Roll Requirements")
        dice_layout = QVBoxLayout()
        
        self.dice_visual = DiceVisualWidget()
        dice_layout.addWidget(self.dice_visual)
        
        dice_group.setLayout(dice_layout)
        layout.addWidget(dice_group)
        
        # Dice Rolling Section
        dice_roll_group = QGroupBox("🎲 Roll Dice")
        dice_roll_layout = QVBoxLayout()
        
        # Roll buttons
        roll_buttons_layout = QHBoxLayout()
        
        self.roll_hit_btn = QPushButton("Roll to Hit")
        self.roll_hit_btn.clicked.connect(self.roll_hit_dice)
        self.roll_hit_btn.setEnabled(False)
        
        self.roll_wound_btn = QPushButton("Roll to Wound")
        self.roll_wound_btn.clicked.connect(self.roll_wound_dice)
        self.roll_wound_btn.setEnabled(False)
        
        self.roll_save_btn = QPushButton("Roll Saves")
        self.roll_save_btn.clicked.connect(self.roll_save_dice)
        self.roll_save_btn.setEnabled(False)
        
        self.roll_all_btn = QPushButton("🎯 Roll All Dice")
        self.roll_all_btn.clicked.connect(self.roll_all_dice)
        self.roll_all_btn.setEnabled(False)
        
        roll_buttons_layout.addWidget(self.roll_hit_btn)
        roll_buttons_layout.addWidget(self.roll_wound_btn)
        roll_buttons_layout.addWidget(self.roll_save_btn)
        roll_buttons_layout.addWidget(self.roll_all_btn)
        
        dice_roll_layout.addLayout(roll_buttons_layout)
        
        # Rolling animation area (separate from results)
        rolling_animation_group = QGroupBox("🎲 Rolling Animation")
        rolling_animation_layout = QHBoxLayout()
        
        # Create animated dice widgets for the rolling animation
        self.rolling_dice = []
        for i in range(8):  # Up to 8 dice rolling at once
            dice_widget = AnimatedDiceWidget()
            dice_widget.setVisible(False)
            self.rolling_dice.append(dice_widget)
            rolling_animation_layout.addWidget(dice_widget)
        
        rolling_animation_layout.addStretch()
        rolling_animation_group.setLayout(rolling_animation_layout)
        dice_roll_layout.addWidget(rolling_animation_group)
        
        # Results area with value-based organization
        dice_animation_group = QGroupBox("🎲 Rolling Dice (Organized by Value)")
        dice_animation_main_layout = QVBoxLayout()
        
        # Create dice grid: 6 rows (one for each dice value, 6 at top, 1 at bottom)
        self.dice_value_rows = {}
        self.animated_dice = []
        
        for value in [6, 5, 4, 3, 2, 1]:  # Top to bottom: 6s to 1s
            # Create row for this dice value
            row_layout = QHBoxLayout()
            row_label = QLabel(f"⚅ {value}s:" if value == 6 else f"⚄ {value}s:" if value == 5 else f"⚃ {value}s:" if value == 4 else f"⚂ {value}s:" if value == 3 else f"⚁ {value}s:" if value == 2 else f"⚀ {value}s:")
            row_label.setFixedWidth(50)
            row_label.setStyleSheet("color: #E0E0E0; font-weight: bold;")
            row_layout.addWidget(row_label)
            
            # Add cutoff indicator (red line for failures, green for successes)
            cutoff_indicator = QLabel("│")  # Vertical bar
            cutoff_indicator.setFixedWidth(15)
            cutoff_indicator.setAlignment(Qt.AlignCenter)
            cutoff_indicator.setStyleSheet("color: #FF6B6B; font-size: 20px; font-weight: bold;")  # Red by default
            row_layout.addWidget(cutoff_indicator)
            
            # Create static dice widgets for this value (up to 15 dice per row)
            dice_widgets_for_value = []
            for i in range(15):
                dice_widget = StaticDiceWidget(value)
                dice_widget.setVisible(False)
                dice_widgets_for_value.append(dice_widget)
                row_layout.addWidget(dice_widget)
            
            row_layout.addStretch()  # Push dice to the left
            self.dice_value_rows[value] = {
                'dice': dice_widgets_for_value,
                'cutoff_indicator': cutoff_indicator
            }
            dice_animation_main_layout.addLayout(row_layout)
        
        dice_animation_group.setLayout(dice_animation_main_layout)
        dice_roll_layout.addWidget(dice_animation_group)
        
        # Dice results display
        self.dice_results = QTextEdit()
        self.dice_results.setMaximumHeight(120)
        self.dice_results.setReadOnly(True)
        self.dice_results.setFont(QFont("Consolas", 9))
        self.dice_results.setPlaceholderText("Dice roll results will appear here...")
        dice_roll_layout.addWidget(self.dice_results)
        
        dice_roll_group.setLayout(dice_roll_layout)
        layout.addWidget(dice_roll_group)
        
        # Detailed calculation results
        details_group = QGroupBox("Calculation Details")
        details_layout = QVBoxLayout()
        
        self.calculation_details = QTextEdit()
        self.calculation_details.setMaximumHeight(150)
        self.calculation_details.setReadOnly(True)
        self.calculation_details.setFont(QFont("Consolas", 9))
        details_layout.addWidget(self.calculation_details)
        
        details_group.setLayout(details_layout)
        layout.addWidget(details_group)
        
        group.setLayout(layout)
        return group
        
    def create_defending_section(self):
        """Create the defending army section"""
        group = QGroupBox("🛡️ DEFENDING FORCE")
        layout = QVBoxLayout()
        
        # Army loading with auto-conversion
        load_layout = QHBoxLayout()
        load_btn = QPushButton("📁 Load Army (JSON)")
        load_btn.clicked.connect(self.load_defending_army)
        
        load_layout.addWidget(load_btn)
        layout.addLayout(load_layout)
        
        self.defending_army_label = QLabel("No army loaded")
        self.defending_army_label.setStyleSheet("color: #888888; font-style: italic;")
        layout.addWidget(self.defending_army_label)
        
        # Unit list
        layout.addWidget(QLabel("🎯 Target Units:"))
        self.defending_units_list = QListWidget()
        self.defending_units_list.itemClicked.connect(self.select_defending_unit)
        layout.addWidget(self.defending_units_list)
        
        # Selected target info
        target_info_group = QGroupBox("Selected Target")
        target_info_layout = QVBoxLayout()
        
        self.defending_unit_name = QLabel("No target selected")
        self.defending_unit_stats = QLabel("")
        target_info_layout.addWidget(self.defending_unit_name)
        target_info_layout.addWidget(self.defending_unit_stats)
        
        # Visual indicators for target
        self.target_visual_indicators = VisualIndicatorWidget()
        target_info_layout.addWidget(self.target_visual_indicators)
        
        target_info_group.setLayout(target_info_layout)
        layout.addWidget(target_info_group)
        
        group.setLayout(layout)
        return group
        
    def calculate_total_dice(self):
        """Calculate total dice to roll based on weapon attacks and unit models"""
        if not self.selected_weapon or not self.current_attacking_unit:
            return 0
            
        # Parse attacks (could be "1", "D6", "2D3", etc.)
        attacks_str = self.selected_weapon.attacks
        models = self.current_attacking_unit.models
        
        # Simple parsing for common attack patterns
        if attacks_str.isdigit():
            attacks_per_model = int(attacks_str)
        elif attacks_str.upper() == "D6":
            attacks_per_model = 3.5  # Average of D6
        elif attacks_str.upper() == "D3":
            attacks_per_model = 2  # Average of D3
        elif "D6" in attacks_str.upper():
            # Handle patterns like "2D6", "3D6"
            multiplier = re.findall(r'(\d+)D6', attacks_str.upper())
            if multiplier:
                attacks_per_model = int(multiplier[0]) * 3.5
            else:
                attacks_per_model = 1
        else:
            attacks_per_model = 1  # Default fallback
            
        total_dice = int(attacks_per_model * models)
        return max(1, total_dice)  # At least 1 die
        
    def load_attacking_army(self):
        """Load army JSON file with auto-detection of BattleScribe format"""
        self._load_army_file(True)
        

    def load_defending_army(self):
        """Load army JSON file with auto-detection of BattleScribe format"""
        self._load_army_file(False)
        
        
    def _load_army_file(self, is_attacking):
        """Generic army file loading with robust error handling and auto-detection"""
        file_filter = "JSON Files (*.json)"
        title = f"Load {'Attacking' if is_attacking else 'Defending'} Army"
        
        file_path, _ = QFileDialog.getOpenFileName(self, title, "", file_filter)
        if not file_path:
            return
            
        try:
            # Auto-detect BattleScribe format and convert if needed
            army = self._load_army_with_auto_conversion(file_path, False)
                
            # Set the loaded army
            if is_attacking:
                self.attacking_army = army
                self.attacking_army_label.setText(f"✅ Loaded: {army.name}")
                self.attacking_army_label.setStyleSheet("color: #00ff00;")
                self.populate_attacking_units()
                self.target_selector.attacking_army = army
            else:
                self.defending_army = army
                self.defending_army_label.setText(f"✅ Loaded: {army.name}")
                self.defending_army_label.setStyleSheet("color: #00ff00;")
                self.populate_defending_units()
                self.target_selector.defending_army = army
                
        except Exception as e:
            error_msg = f"Failed to load army: {str(e)}"
            QMessageBox.critical(self, "Error", error_msg)
            
            if is_attacking:
                self.attacking_army_label.setText("❌ Load failed")
                self.attacking_army_label.setStyleSheet("color: #ff0000;")
            else:
                self.defending_army_label.setText("❌ Load failed")
                self.defending_army_label.setStyleSheet("color: #ff0000;")
    
    def _load_army_with_auto_conversion(self, file_path, force_battlescribe=False):
        """Load army with automatic BattleScribe detection and conversion"""
        try:
            # First, try to load as a standard army file
            if not force_battlescribe:
                try:
                    army = self.army_loader.load_army(file_path)
                    return army
                except Exception as e:
                    # If it fails, it might be a BattleScribe file - try converting
                    pass
            
            # Load and check if it's a BattleScribe file
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check for BattleScribe format indicators
            if self._is_battlescribe_format(data):
                # Convert BattleScribe format to our army format
                army_data = self.battlescribe_converter.convert_battlescribe_to_army(data)
                
                # Create army document from converted data
                from army_document import ArmyDocument
                army = ArmyDocument(army_data)
                return army
            else:
                # Try loading as standard format one more time
                army = self.army_loader.load_army(file_path)
                return army
                
        except Exception as e:
            raise Exception(f"Could not load army file. Error: {str(e)}")
    
    def _is_battlescribe_format(self, data):
        """Check if the JSON data is in BattleScribe format"""
        # BattleScribe files have a 'roster' key with 'forces' inside
        if isinstance(data, dict) and 'roster' in data:
            roster = data['roster']
            if isinstance(roster, dict) and 'forces' in roster:
                return True
        return False
                
    def populate_attacking_units(self):
        """Populate the attacking units list"""
        self.attacking_units_list.clear()
        if self.attacking_army:
            for unit in self.attacking_army.units:
                self.attacking_units_list.addItem(f"⚔️ {unit.name} ({unit.unit_type})")
                
    def populate_defending_units(self):
        """Populate the defending units list"""
        self.defending_units_list.clear()
        if self.defending_army:
            for unit in self.defending_army.units:
                self.defending_units_list.addItem(f"🛡️ {unit.name} ({unit.unit_type})")
                
    def select_attacking_unit(self, item):
        """Select an attacking unit"""
        if self.attacking_army:
            unit_index = self.attacking_units_list.row(item)
            self.current_attacking_unit = self.attacking_army.units[unit_index]
            self.target_selector.select_attacking_unit(self.current_attacking_unit)
            self.update_attacking_unit_display()
            # Reset weapon selection when changing units
            self.selected_weapon = None
            self.target_selector.selected_weapon = None
            self.fire_weapon_btn.setEnabled(False)
            self.trigger_auto_calculation()
            
    def select_defending_unit(self, item):
        """Select a defending unit (target)"""
        if self.defending_army:
            unit_index = self.defending_units_list.row(item)
            self.current_defending_unit = self.defending_army.units[unit_index]
            self.target_selector.select_target_unit(self.current_defending_unit)
            self.update_defending_unit_display()
            self.trigger_auto_calculation()
            
    def select_weapon(self, item):
        """Select a weapon from the attacking unit"""
        if self.current_attacking_unit:
            weapon_index = self.attacking_weapons_list.row(item)
            self.selected_weapon = self.current_attacking_unit.weapons[weapon_index]
            self.target_selector.select_weapon(self.selected_weapon)
            self.fire_weapon_btn.setEnabled(not self.selected_weapon.fired)
            # Force immediate recalculation when weapon changes
            self.trigger_auto_calculation()
            
    def trigger_auto_calculation(self):
        """Trigger automatic calculation after a short delay"""
        self.calculation_timer.stop()
        self.calculation_timer.start(50)  # Reduced delay for more responsive updates
        
    def auto_calculate_combat(self):
        """Automatically calculate combat when ready"""
        if self.target_selector.is_ready_for_calculation():
            result = self.target_selector.get_combat_calculation()
            if result:
                total_dice = self.calculate_total_dice()
                self.display_dice_results(result, total_dice)
                weapon_name = self.selected_weapon.name
                attacker_name = self.current_attacking_unit.name
                target_name = self.current_defending_unit.name
                self.combat_status.setText(f"🎯 {attacker_name} → {weapon_name} → {target_name}")
                self.combat_status.setStyleSheet("color: #00ff00; font-weight: bold;")
        else:
            self.combat_status.setText("Select weapon and target for instant calculation")
            self.combat_status.setStyleSheet("color: #888888; font-style: italic;")
            self.dice_visual.set_dice_rolls(7, 7, 7, 7, 0)
            self.calculation_details.clear()
            
    def display_dice_results(self, result, total_dice):
        """Display the dice roll results with enhanced visuals"""
        # Update dice visual widget with total dice count
        self.dice_visual.set_dice_rolls(
            result.hit_roll, result.wound_roll, 
            result.save_roll, result.invuln_save_roll, total_dice
        )
        
        # Enable dice rolling buttons
        self.roll_hit_btn.setEnabled(result.hit_roll <= 6 and total_dice > 0)
        self.roll_wound_btn.setEnabled(False)  # Enable after hit rolls
        self.roll_save_btn.setEnabled(False)   # Enable after wound rolls
        self.roll_all_btn.setEnabled(True)
        
        # Store current result for dice rolling
        self.current_dice_result = result
        
        # Display detailed results
        weapon = self.selected_weapon
        attacker = self.current_attacking_unit
        target = self.current_defending_unit
        
        details = []
        details.append(f"🎯 COMBAT: {attacker.name} vs {target.name}")
        details.append(f"🔫 WEAPON: {weapon.name}")
        details.append(f"   └─ A:{weapon.attacks} S:{weapon.strength} AP:{weapon.ap} D:{weapon.damage}")
        details.append(f"🎲 TOTAL DICE: {total_dice} ({weapon.attacks} attacks × {attacker.models} models)")
        details.append("")
        details.append("📊 DICE REQUIREMENTS:")
        
        # Hit roll details
        hit_str = f"{result.hit_roll}+" if result.hit_roll <= 6 else "Auto-miss"
        skill_type = "WS" if weapon.type.upper() == "MELEE" else "BS"
        skill_val = attacker.weapon_skill if weapon.type.upper() == "MELEE" else attacker.ballistic_skill
        details.append(f"   🎲 HIT: {hit_str} (using {skill_type} {skill_val}+)")
        
        # Wound roll details
        wound_str = f"{result.wound_roll}+" if result.wound_roll <= 6 else "No wound"
        details.append(f"   💥 WOUND: {wound_str} (S{weapon.strength} vs T{target.toughness})")
        
        # Save roll details with better AP explanation
        # AP makes saves worse - subtract AP from armor save
        modified_save = target.armor_save - weapon.ap
        if result.save_roll <= 6:
            armor_str = f"{result.save_roll}+"
            details.append(f"   🛡️ ARMOR SAVE: {armor_str} ({target.armor_save}+ modified by AP{weapon.ap})")
        else:
            # Show why it auto-fails
            details.append(f"   🛡️ ARMOR SAVE: Auto-fail ({target.armor_save}+ modified by AP{weapon.ap} = {modified_save}+, worse than 6+)")
            if result.invuln_save_roll <= 6:
                details.append(f"   ⚠️  Must use invulnerable save instead!")
    
        if result.invuln_save_roll <= 6:
            details.append(f"   ✨ INVULN SAVE: {result.invuln_save_roll}+ (unmodified by AP)")
        elif result.save_roll > 6:
            details.append(f"   ✨ INVULN SAVE: None available - attack auto-wounds!")
        
        self.calculation_details.setText("\\n".join(details))
        
    def update_attacking_unit_display(self):
        """Update the attacking unit display"""
        if self.current_attacking_unit:
            unit = self.current_attacking_unit
            self.attacking_unit_name.setText(f"⚔️ {unit.name}")
            self.attacking_unit_name.setStyleSheet("color: #74a0e2; font-weight: 600;")
            
            stats_text = (f"Type: {unit.unit_type} | Models: {unit.models} | Wounds: {unit.wounds}\n"
                         f"WS: {unit.weapon_skill}+ | BS: {unit.ballistic_skill}+ | "
                         f"T: {unit.toughness} | Sv: {unit.armor_save}+")
            if unit.invulnerable_save < 7:
                stats_text += f" | Inv: {unit.invulnerable_save}+"
            self.attacking_unit_stats.setText(stats_text)
            
            # Update weapons list
            self.attacking_weapons_list.clear()
            for weapon in unit.weapons:
                status_icon = "🔥" if weapon.fired else "🔫"
                status_text = "FIRED" if weapon.fired else "READY"
                weapon_text = (f"{status_icon} [{status_text}] {weapon.name}\n"
                              f"    A:{weapon.attacks} S:{weapon.strength} AP:{weapon.ap} D:{weapon.damage}")
                self.attacking_weapons_list.addItem(weapon_text)
                
    def update_defending_unit_display(self):
        """Update the defending unit display"""
        if self.current_defending_unit:
            unit = self.current_defending_unit
            self.defending_unit_name.setText(f"🎯 {unit.name}")
            self.defending_unit_name.setStyleSheet("color: #e28a74; font-weight: 600;")
            
            stats_text = (f"Type: {unit.unit_type} | Models: {unit.models} | Wounds: {unit.wounds}\n"
                         f"T: {unit.toughness} | Sv: {unit.armor_save}+")
            if unit.invulnerable_save < 7:
                stats_text += f" | Inv: {unit.invulnerable_save}+"
            self.defending_unit_stats.setText(stats_text)
            
            # Update visual indicators
            self.target_visual_indicators.set_unit_type(unit.unit_type)
            self.target_visual_indicators.set_wounds(unit.wounds, unit.wounds)
            self.target_visual_indicators.set_status([])
            
    def fire_weapon(self):
        """Mark the selected weapon as fired"""
        if self.selected_weapon and not self.selected_weapon.fired:
            self.selected_weapon.mark_fired()
            self.fire_weapon_btn.setEnabled(False)
            self.update_attacking_unit_display()
            
    def next_phase(self):
        """Advance to the next phase"""
        self.turn_tracker.advance_phase()
        self.update_turn_display()
        
    def reset_turn(self):
        """Reset the turn and all weapons"""
        self.turn_tracker.reset()
        if self.attacking_army:
            self.attacking_army.reset_turn()
        if self.defending_army:
            self.defending_army.reset_turn()
        self.update_turn_display()
        if self.current_attacking_unit:
            self.update_attacking_unit_display()
            
    def update_turn_display(self):
        """Update the turn tracker display"""
        self.turn_label.setText(f"Turn {self.turn_tracker.current_turn} - {self.turn_tracker.current_phase} Phase")
    
    def roll_hit_dice(self):
        """Roll dice for hit rolls with animations"""
        if not self.current_dice_result or not self.current_attacking_unit or not self.selected_weapon:
            return
        
        if self.current_dice_result.hit_roll > 6:
            self.dice_results.append("🎯 HIT ROLLS: Auto-miss - no dice to roll!")
            return
        
        total_dice = self.calculate_total_dice()
        if total_dice == 0:
            self.dice_results.append("🎯 HIT ROLLS: No dice to roll!")
            return
        
        # Limit dice display to 6 for visual purposes
        dice_to_show = min(total_dice, 6)
        
        # Roll the dice
        rolls = [random.randint(1, 6) for _ in range(total_dice)]
        hits = sum(1 for roll in rolls if roll >= self.current_dice_result.hit_roll)
        
        # Show and animate dice with hit threshold
        self._animate_dice_roll(dice_to_show, rolls[:dice_to_show], self.current_dice_result.hit_roll)
        
        # Delay results display to allow animation to complete (2 seconds + buffer)
        QTimer.singleShot(2200, lambda: self._display_hit_results(total_dice, rolls, hits))
        
        # Enable wound rolling if there are hits (after animation)
        if hits > 0 and self.current_dice_result.wound_roll <= 6:
            QTimer.singleShot(2300, lambda: self.roll_wound_btn.setEnabled(True))
    
    def roll_wound_dice(self):
        """Roll dice for wound rolls with animations"""
        if not self.current_dice_result:
            return
        
        if self.current_dice_result.wound_roll > 6:
            self.dice_results.append("💥 WOUND ROLLS: Cannot wound - no dice to roll!")
            return
        
        # For simplicity, assume we're rolling with the number of hits from previous roll
        # In a real game, user would specify how many dice to roll
        dice_count = 3  # Default for demo - could be extracted from hit results
        
        # Roll the dice
        rolls = [random.randint(1, 6) for _ in range(dice_count)]
        wounds = sum(1 for roll in rolls if roll >= self.current_dice_result.wound_roll)
        
        # Show and animate dice
        self._animate_dice_roll(dice_count, rolls)
        
        # Delay results display to allow animation to complete (2 seconds + buffer)
        QTimer.singleShot(2200, lambda: self._display_wound_results(dice_count, rolls, wounds))
        
        # Enable save rolling if there are wounds (after animation)
        if wounds > 0 and (self.current_dice_result.save_roll <= 6 or self.current_dice_result.invuln_save_roll <= 6):
            QTimer.singleShot(2300, lambda: self.roll_save_btn.setEnabled(True))
    
    def roll_save_dice(self):
        """Roll dice for save rolls with animations"""
        if not self.current_dice_result:
            return
        
        # Determine which save to use
        armor_save_available = self.current_dice_result.save_roll <= 6
        invuln_save_available = self.current_dice_result.invuln_save_roll <= 6
        
        if not armor_save_available and not invuln_save_available:
            self.dice_results.append("🛡️ SAVE ROLLS: No saves available - all wounds go through!")
            return
        
        # For demo, assume rolling saves for 2 wounds
        dice_count = 2
        
        # Choose the better save (lower number)
        if armor_save_available and invuln_save_available:
            save_needed = min(self.current_dice_result.save_roll, self.current_dice_result.invuln_save_roll)
            save_type = "Best Available"
        elif armor_save_available:
            save_needed = self.current_dice_result.save_roll
            save_type = "Armor"
        else:
            save_needed = self.current_dice_result.invuln_save_roll
            save_type = "Invulnerable"
        
        # Roll the dice
        rolls = [random.randint(1, 6) for _ in range(dice_count)]
        saves = sum(1 for roll in rolls if roll >= save_needed)
        wounds_taken = dice_count - saves
        
        # Show and animate dice
        self._animate_dice_roll(dice_count, rolls)
        
        # Delay results display to allow animation to complete (2 seconds + buffer)
        QTimer.singleShot(2200, lambda: self._display_save_results(dice_count, rolls, saves, wounds_taken, save_type))
    
    def roll_all_dice(self):
        """Roll all dice in sequence"""
        if not self.current_dice_result:
            self.dice_results.append("❌ No combat calculation available - select weapon and target first!")
            return
        
        self.dice_results.clear()
        self.dice_results.append("🎲 ROLLING ALL DICE IN SEQUENCE...\n")
        
        # Roll hits first
        self.roll_hit_dice()
        
        # Small delay for better UX (optional)
        self.dice_results.append("")
        
        # Roll wounds
        self.roll_wound_dice()
        
        self.dice_results.append("")
        
        # Roll saves
        self.roll_save_dice()
        
        self.dice_results.append("\n🏁 COMBAT SEQUENCE COMPLETE!")
    
    def _animate_dice_roll(self, num_dice, roll_values, roll_threshold=7):
        """Animate dice rolling then gradually populate results."""
        # Store roll data for gradual population
        self.current_roll_values = roll_values
        self.current_roll_threshold = roll_threshold
        
        # Clear previous results
        self._clear_dice_results()
        
        # Show rolling animation first
        dice_to_animate = min(num_dice, len(self.rolling_dice))
        for i in range(dice_to_animate):
            dice_widget = self.rolling_dice[i]
            dice_widget.setVisible(True)
            target_value = roll_values[i] if i < len(roll_values) else random.randint(1, 6)
            QTimer.singleShot(i * 100, lambda dw=dice_widget, val=target_value: dw.roll_dice(val))
        
        # After animation completes, start gradual population
        QTimer.singleShot(2100, self._start_gradual_population)
    
    def _display_hit_results(self, total_dice, rolls, hits):
        """Display hit roll results after animation."""
        rolls_str = ", ".join(str(roll) for roll in rolls)
        result_text = f"🎯 HIT ROLLS ({total_dice} dice, need {self.current_dice_result.hit_roll}+):\n"
        result_text += f"   Rolled: [{rolls_str}]\n"
        result_text += f"   ✅ HITS: {hits}/{total_dice}\n"
        
        self.dice_results.append(result_text)
    
    def _display_wound_results(self, dice_count, rolls, wounds):
        """Display wound roll results after animation."""
        rolls_str = ", ".join(str(roll) for roll in rolls)
        result_text = f"💥 WOUND ROLLS ({dice_count} dice, need {self.current_dice_result.wound_roll}+):\n"
        result_text += f"   Rolled: [{rolls_str}]\n"
        result_text += f"   ✅ WOUNDS: {wounds}/{dice_count}\n"
        
        self.dice_results.append(result_text)
    
    def _display_save_results(self, dice_count, rolls, saves, wounds_taken, save_type):
        """Display save roll results after animation."""
        rolls_str = ", ".join(str(roll) for roll in rolls)
        result_text = f"🛡️ {save_type.upper()} SAVE ROLLS ({dice_count} dice, need {self._get_save_needed()}+):\n"
        result_text += f"   Rolled: [{rolls_str}]\n"
        result_text += f"   ✅ SAVES: {saves}/{dice_count}\n"
        result_text += f"   ❌ WOUNDS TAKEN: {wounds_taken}\n"
        
        self.dice_results.append(result_text)
    
    def _get_save_needed(self):
        """Get the save value needed for current calculation."""
        if not self.current_dice_result:
            return 7
        
        armor_save_available = self.current_dice_result.save_roll <= 6
        invuln_save_available = self.current_dice_result.invuln_save_roll <= 6
        
        if armor_save_available and invuln_save_available:
            return min(self.current_dice_result.save_roll, self.current_dice_result.invuln_save_roll)
        elif armor_save_available:
            return self.current_dice_result.save_roll
        elif invuln_save_available:
            return self.current_dice_result.invuln_save_roll
        else:
            return 7
    
    def _clear_dice_results(self):
        """Clear all dice from the results grid."""
        # Hide rolling dice
        for dice_widget in self.rolling_dice:
            dice_widget.setVisible(False)
        
        # Hide all result dice
        for value in [6, 5, 4, 3, 2, 1]:
            dice_widgets = self.dice_value_rows[value]['dice']
            for dice_widget in dice_widgets:
                dice_widget.setVisible(False)
    
    def _start_gradual_population(self):
        """Start gradually populating dice results."""
        if not hasattr(self, 'current_roll_values'):
            return
        
        # Hide rolling dice now that animation is done
        for dice_widget in self.rolling_dice:
            dice_widget.setVisible(False)
        
        # Update cutoff indicators based on current threshold
        self._update_cutoff_indicators()
        
        # Count dice by value
        value_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
        for value in self.current_roll_values:
            if 1 <= value <= 6:
                value_counts[value] += 1
        
        # Calculate population speed based on total dice count
        total_dice = len(self.current_roll_values)
        if total_dice <= 5:
            delay_per_die = 200  # Slower for few dice
        elif total_dice <= 10:
            delay_per_die = 150  # Medium speed
        else:
            delay_per_die = 100  # Faster for many dice
        
        # Gradually populate dice in each row
        current_delay = 0
        for value in [6, 5, 4, 3, 2, 1]:  # Top to bottom
            count = value_counts[value]
            if count > 0:
                dice_widgets = self.dice_value_rows[value]['dice']
                
                for i in range(min(count, len(dice_widgets))):
                    dice_widget = dice_widgets[i]
                    is_success = value >= self.current_roll_threshold
                    
                    # Schedule this die to appear
                    QTimer.singleShot(current_delay, 
                                    lambda dw=dice_widget, val=value, success=is_success: 
                                    self._show_result_die(dw, val, success))
                    current_delay += delay_per_die
    
    def _show_result_die(self, dice_widget, value, is_success):
        """Show a single result die with appropriate coloring."""
        dice_widget.set_value(value, is_success)
        dice_widget.setVisible(True)
    
    def _update_cutoff_indicators(self):
        """Update the cutoff indicators based on current roll threshold."""
        threshold = getattr(self, 'current_roll_threshold', 7)
        
        for value in [6, 5, 4, 3, 2, 1]:
            indicator = self.dice_value_rows[value]['cutoff_indicator']
            
            if value >= threshold:
                # Success values - green indicator
                indicator.setStyleSheet("color: #4CAF50; font-size: 20px; font-weight: bold;")
                indicator.setText("✓")  # Checkmark
            else:
                # Failure values - red indicator  
                indicator.setStyleSheet("color: #FF6B6B; font-size: 20px; font-weight: bold;")
                indicator.setText("✗")  # X mark
