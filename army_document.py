from dataclasses import dataclass
from typing import List, Dict, Any
import json

@dataclass
class Weapon:
    name: str
    range: str
    type: str
    attacks: str = "1"
    skill: int = 4  # WS for melee, BS for ranged
    strength: int = 4
    ap: int = 0  # Armor Penetration
    damage: str = "1"
    fired: bool = False

    def mark_fired(self):
        self.fired = True

    def reset(self):
        self.fired = False

@dataclass
class Unit:
    name: str
    unit_type: str
    models: int
    wounds: int
    weapons: List[Weapon]
    # Combat stats for dice calculations
    weapon_skill: int = 4  # WS - melee hit rolls
    ballistic_skill: int = 4  # BS - ranged hit rolls
    toughness: int = 4  # T - wound rolls
    armor_save: int = 6  # Sv - save rolls
    invulnerable_save: int = 7  # Invuln save (7 = none)

class ArmyDocument:
    def __init__(self, data: Dict[str, Any]):
        self._validate_data(data)
        self.name = data["name"]
        self.units = self._parse_units(data["units"])
        self._current_turn = 0

    def _validate_data(self, data: Dict[str, Any]):
        if not isinstance(data, dict):
            raise ValueError("Army document must be a dictionary")
        if "name" not in data or "units" not in data:
            raise ValueError("Army document must contain name and units")

    def _parse_units(self, units_data: List[Dict[str, Any]]) -> List[Unit]:
        units = []
        for unit_data in units_data:
            weapons = []
            for w in unit_data.get("weapons", []):
                weapon = Weapon(
                    name=w["name"],
                    range=w["range"],
                    type=w["type"],
                    attacks=w.get("attacks", "1"),
                    skill=w.get("skill", 4),
                    strength=w.get("strength", 4),
                    ap=w.get("ap", 0),
                    damage=w.get("damage", "1")
                )
                weapons.append(weapon)
            
            units.append(Unit(
                name=unit_data["name"],
                unit_type=unit_data.get("type", "INFANTRY"),
                models=unit_data.get("models", 1),
                wounds=unit_data.get("wounds", 1),
                weapons=weapons,
                weapon_skill=unit_data.get("weapon_skill", 4),
                ballistic_skill=unit_data.get("ballistic_skill", 4),
                toughness=unit_data.get("toughness", 4),
                armor_save=unit_data.get("armor_save", 6),
                invulnerable_save=unit_data.get("invulnerable_save", 7)
            ))
        return units

    def reset_turn(self):
        """Reset all weapons for a new turn."""
        self._current_turn += 1
        for unit in self.units:
            for weapon in unit.weapons:
                weapon.reset()
