"""
Combat Mechanics System for Tabletop Army Manager

This module provides combat calculation functionality for tabletop miniature games,
including:
- Hit roll calculations based on unit skills
- Wound roll calculations based on weapon strength vs target toughness
- Save roll calculations with armor penetration modifiers
- Target selection management between opposing armies
"""

from dataclasses import dataclass
from typing import Optional, Tuple

from army_document import Unit, Weapon


@dataclass
class DiceRollResult:
    """Represents the required dice rolls for a combat interaction"""
    hit_roll: int  # Required roll to hit (2-6, or 7 if impossible)
    wound_roll: int  # Required roll to wound (2-6, or 7 if impossible)
    save_roll: int  # Required roll to save (2-6, or 7 if auto-fail)
    invuln_save_roll: int  # Required invulnerable save roll (2-6, or 7 if none)
    
    def __str__(self):
        hit_str = f"{self.hit_roll}+" if self.hit_roll <= 6 else "Auto-miss"
        wound_str = f"{self.wound_roll}+" if self.wound_roll <= 6 else "No wound"
        save_str = f"{self.save_roll}+" if self.save_roll <= 6 else "Auto-fail"
        invuln_str = f"{self.invuln_save_roll}+" if self.invuln_save_roll <= 6 else "None"
        
        return f"Hit: {hit_str} | Wound: {wound_str} | Save: {save_str} | Invuln: {invuln_str}"


class CombatCalculator:
    """Calculates dice rolls required for Warhammer 40k combat interactions"""
    
    @staticmethod
    def calculate_hit_roll(weapon: Weapon, attacking_unit: Unit) -> int:
        """
        Calculate required hit roll based on weapon skill/ballistic skill
        Returns: Required dice roll (2-6) or 7 if impossible
        """
        if weapon.type.upper() == "MELEE":
            # Use weapon skill for melee weapons
            skill = attacking_unit.weapon_skill
        else:
            # Use ballistic skill for ranged weapons
            skill = attacking_unit.ballistic_skill
        
        # Override with weapon's specific skill if provided
        if hasattr(weapon, 'skill') and weapon.skill > 0:
            skill = weapon.skill
        
        # Standard 40k hit roll calculation
        if skill <= 1:
            return 2  # 2+ to hit
        elif skill <= 6:
            return skill  # Equal to skill value
        else:
            return 7  # Impossible to hit
    
    @staticmethod
    def calculate_wound_roll(weapon: Weapon, target_unit: Unit) -> int:
        """
        Calculate required wound roll based on weapon strength vs target toughness
        Returns: Required dice roll (2-6) or 7 if impossible
        """
        strength = weapon.strength
        toughness = target_unit.toughness
        
        if strength >= toughness * 2:
            return 2  # 2+ to wound
        elif strength > toughness:
            return 3  # 3+ to wound
        elif strength == toughness:
            return 4  # 4+ to wound
        elif strength >= toughness // 2:
            return 5  # 5+ to wound
        else:
            return 6  # 6+ to wound
    
    @staticmethod
    def calculate_save_roll(weapon: Weapon, target_unit: Unit) -> Tuple[int, int]:
        """
        Calculate required save rolls (armor save and invulnerable save)
        Returns: (armor_save_roll, invuln_save_roll) - 7 means no save available
        """
        # Calculate modified armor save - AP makes saves worse
        # Since AP is stored as negative (e.g. -2 for AP-2), we subtract it to make save worse
        modified_armor_save = target_unit.armor_save - weapon.ap
        
        # If modified save is worse than 6+, it auto-fails (unless invuln applies)
        if modified_armor_save > 6:
            armor_save_roll = 7  # Auto-fail
        else:
            armor_save_roll = max(modified_armor_save, 2)  # Can't be better than 2+
        
        # Invulnerable save is unmodified by AP
        invuln_save_roll = target_unit.invulnerable_save if target_unit.invulnerable_save <= 6 else 7
        
        return armor_save_roll, invuln_save_roll
    
    @classmethod
    def calculate_combat_rolls(cls, weapon: Weapon, attacking_unit: Unit, target_unit: Unit) -> DiceRollResult:
        """
        Calculate all required dice rolls for a combat interaction
        """
        hit_roll = cls.calculate_hit_roll(weapon, attacking_unit)
        wound_roll = cls.calculate_wound_roll(weapon, target_unit)
        armor_save_roll, invuln_save_roll = cls.calculate_save_roll(weapon, target_unit)
        
        return DiceRollResult(
            hit_roll=hit_roll,
            wound_roll=wound_roll,
            save_roll=armor_save_roll,
            invuln_save_roll=invuln_save_roll
        )


class TargetSelector:
    """Manages target selection between two armies"""
    
    def __init__(self):
        self.attacking_army = None
        self.defending_army = None
        self.selected_attacking_unit = None
        self.selected_weapon = None
        self.selected_target_unit = None
    
    def set_armies(self, attacking_army, defending_army):
        """Set the two armies for combat"""
        self.attacking_army = attacking_army
        self.defending_army = defending_army
        self.reset_selection()
    
    def select_attacking_unit(self, unit: Unit):
        """Select the attacking unit"""
        self.selected_attacking_unit = unit
        self.selected_weapon = None  # Reset weapon selection
    
    def select_weapon(self, weapon: Weapon):
        """Select the weapon to use"""
        if self.selected_attacking_unit and weapon in self.selected_attacking_unit.weapons:
            self.selected_weapon = weapon
    
    def select_target_unit(self, unit: Unit):
        """Select the target unit"""
        if self.defending_army and unit in self.defending_army.units:
            self.selected_target_unit = unit
    
    def get_combat_calculation(self) -> Optional[DiceRollResult]:
        """Get dice roll calculation for current selection"""
        if all([self.selected_attacking_unit, self.selected_weapon, self.selected_target_unit]):
            return CombatCalculator.calculate_combat_rolls(
                self.selected_weapon,
                self.selected_attacking_unit,
                self.selected_target_unit
            )
        return None
    
    def reset_selection(self):
        """Reset all selections"""
        self.selected_attacking_unit = None
        self.selected_weapon = None
        self.selected_target_unit = None
    
    def is_ready_for_calculation(self) -> bool:
        """Check if all selections are made for calculation"""
        return all([
            self.selected_attacking_unit,
            self.selected_weapon,
            self.selected_target_unit
        ])
