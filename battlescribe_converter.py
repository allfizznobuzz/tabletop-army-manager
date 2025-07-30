#!/usr/bin/env python3
"""
BattleScribe to Army Manager Converter

This module provides functionality to convert BattleScribe JSON exports
into the simplified army document format used by the Tabletop Army Manager.

BattleScribe is a popular army building application for tabletop miniature games.
This converter extracts unit statistics, weapons, and other relevant data
from BattleScribe's complex nested JSON structure and transforms it into
a more manageable format for combat calculations.
"""

import json
import re
import sys
from typing import Any, Dict, List

class BattleScribeConverter:
    def __init__(self):
        self.unit_type_mapping = {
            "Infantry": "INFANTRY",
            "Character": "CHARACTER", 
            "Monster": "MONSTER",
            "Vehicle": "VEHICLE",
            "Beast": "BEAST",
            "Mounted": "MOUNTED",
            "Flyer": "FLYER"
        }
    
    def convert_battlescribe_to_army(self, battlescribe_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert BattleScribe JSON to our army document format."""
        roster = battlescribe_data.get("roster", {})
        forces = roster.get("forces", [])
        
        if not forces:
            raise ValueError("No forces found in BattleScribe data")
        
        force = forces[0]  # Take the first force
        selections = force.get("selections", [])
        
        # Extract army name (try to get it from roster or use default)
        army_name = roster.get("name", "Imported Army")
        
        # Convert units - include both "unit" and standalone "model" types
        units = []
        for selection in selections:
            selection_type = selection.get("type")
            if selection_type in ["unit", "model"]:
                unit = self._convert_unit(selection)
                if unit:
                    units.append(unit)
        
        return {
            "name": army_name,
            "units": units
        }
    
    def _convert_unit(self, unit_selection: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a BattleScribe unit selection to our unit format."""
        unit_name = unit_selection.get("name", "Unknown Unit")
        
        # Determine unit type from categories
        unit_type = self._determine_unit_type(unit_selection.get("categories", []))
        
        # Extract unit stats and calculate total models
        unit_info = self.extract_unit_info(unit_selection)
        total_models = self._calculate_total_models(unit_selection)
        unit_info["models"] = total_models
        
        # Extract and aggregate weapons
        weapons = self._extract_and_aggregate_weapons(unit_selection)
        
        return {
            "name": unit_name,
            "type": unit_type,
            "models": unit_info["models"],
            "wounds": unit_info["wounds"],
            "weapon_skill": unit_info["weapon_skill"],
            "ballistic_skill": unit_info["ballistic_skill"],
            "toughness": unit_info["toughness"],
            "armor_save": unit_info["armor_save"],
            "invulnerable_save": unit_info["invulnerable_save"],
            "weapons": weapons
        }
    
    def extract_unit_info(self, unit_data):
        """Extract basic unit information from BattleScribe unit data"""
        unit_name = unit_data.get("name", "Unknown Unit")
        unit_type = self._determine_unit_type(unit_data.get("categories", []))
        
        # Default stats - numeric values default to 0
        unit_info = {
            "name": unit_name,
            "type": unit_type,
            "models": 1,
            "wounds": 0,
            "weapon_skill": 0,
            "ballistic_skill": 0,
            "toughness": 0,
            "armor_save": 0,
            "invulnerable_save": 7  # 7 means no invulnerable save
        }
        
        # Extract stats from profiles
        if "profiles" in unit_data:
            for profile in unit_data["profiles"]:
                if "characteristics" in profile:
                    chars = profile["characteristics"]
                    for char in chars:
                        char_name = char.get("name", "").lower()
                        char_value = char.get("$text", "")  # Use $text not $t
                        
                        if char_name == "m" or char_name == "movement":
                            continue  # We don't need movement for combat
                        elif char_name == "ws" or char_name == "weapon skill":
                            try:
                                unit_info["weapon_skill"] = int(char_value.replace("+", ""))
                            except:
                                pass
                        elif char_name == "bs" or char_name == "ballistic skill":
                            try:
                                unit_info["ballistic_skill"] = int(char_value.replace("+", ""))
                            except:
                                pass
                        elif char_name == "s" or char_name == "strength":
                            continue  # Unit strength not used in our system
                        elif char_name == "t" or char_name == "toughness":
                            try:
                                unit_info["toughness"] = int(char_value)
                            except:
                                pass
                        elif char_name == "w" or char_name == "wounds":
                            try:
                                unit_info["wounds"] = int(char_value)
                            except:
                                pass
                        elif char_name == "a" or char_name == "attacks":
                            continue  # Unit attacks handled by weapons
                        elif char_name == "ld" or char_name == "leadership":
                            continue  # Not needed for combat
                        elif char_name == "sv" or char_name == "save":
                            try:
                                unit_info["armor_save"] = int(char_value.replace("+", ""))
                            except:
                                pass
        
        # Note: We no longer guess wounds based on point costs as this is unreliable
        # Wounds should be extracted from the unit profile characteristics only
        
        # Check for invulnerable save in abilities profiles
        if "profiles" in unit_data:
            for profile in unit_data["profiles"]:
                profile_name = profile.get("name", "").lower()
                if "invulnerable save" in profile_name:
                    # Extract invuln save from abilities profile
                    if "characteristics" in profile:
                        for char in profile["characteristics"]:
                            description = char.get("$text", "")
                            # Look for patterns like "4+ invulnerable save" or "has a 4+ invulnerable save"
                            inv_match = re.search(r'(\d+)\+.*invulnerable', description.lower())
                            if inv_match:
                                unit_info["invulnerable_save"] = int(inv_match.group(1))
                                break
    
        # Also check in rules as fallback
        if unit_info["invulnerable_save"] == 7 and "rules" in unit_data:
            for rule in unit_data["rules"]:
                rule_name = rule.get("name", "").lower()
                if "invulnerable" in rule_name or "inv" in rule_name:
                    # Try to extract invuln save value
                    description = rule.get("description", "")
                    inv_match = re.search(r'(\d+)\+.*invulnerable', description.lower())
                    if inv_match:
                        unit_info["invulnerable_save"] = int(inv_match.group(1))
        
        return unit_info
    
    def _determine_unit_type(self, categories: List[Dict[str, Any]]) -> str:
        """Determine unit type from BattleScribe categories."""
        for category in categories:
            category_name = category.get("name", "")
            if category_name in self.unit_type_mapping:
                return self.unit_type_mapping[category_name]
        return "INFANTRY"  # Default fallback
    
    def _extract_wounds(self, unit_profile: Dict[str, Any]) -> int:
        """Extract wounds from unit profile."""
        if not unit_profile:
            return 1
            
        characteristics = unit_profile.get("characteristics", [])
        for char in characteristics:
            if char.get("name") == "W":
                try:
                    return int(char.get("$text", "1"))
                except ValueError:
                    return 1
        return 1
    
    def _extract_weapons(self, unit_selection: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract weapons from unit selection with proper count handling."""
        weapons = []
        
        # Check direct profiles for weapons
        profiles = unit_selection.get("profiles", [])
        for profile in profiles:
            if profile.get("typeName") in ["Ranged Weapons", "Melee Weapons"]:
                weapon = self._convert_weapon_profile(profile)
                if weapon:
                    weapons.append(weapon)
        
        # Check selections for weapon upgrades (this is where most weapons are)
        selections = unit_selection.get("selections", [])
        for selection in selections:
            weapon_count = selection.get("number", 1)  # Get weapon count
            weapon_profiles = selection.get("profiles", [])
            
            for profile in weapon_profiles:
                if profile.get("typeName") in ["Ranged Weapons", "Melee Weapons"]:
                    weapon = self._convert_weapon_profile(profile, weapon_count)
                    if weapon:
                        weapons.append(weapon)
            
            # Recursively check nested selections
            nested_weapons = self._extract_weapons(selection)
            weapons.extend(nested_weapons)
        
        return weapons
    
    def _convert_weapon_profile(self, weapon_profile: Dict[str, Any], weapon_count: int = 1) -> Dict[str, Any]:
        """Convert a BattleScribe weapon profile to our weapon format."""
        weapon_name = weapon_profile.get("name", "Unknown Weapon")
        
        # Add weapon count to name if more than 1
        if weapon_count > 1:
            weapon_name = f"{weapon_name} (x{weapon_count})"
        
        # Extract weapon stats directly from characteristics
        weapon_stats = self._extract_weapon_stats_from_profile(weapon_profile)
        weapon_stats["name"] = weapon_name  # Update name with count
        
        return weapon_stats
    
    def _calculate_total_models(self, unit_selection: Dict[str, Any]) -> int:
        """Calculate the total number of models in a unit from nested selections"""
        total_models = unit_selection.get("number", 1)  # Default for standalone models
        
        # Check nested selections for model counts
        selections = unit_selection.get("selections", [])
        nested_model_count = 0
        
        for selection in selections:
            if selection.get("type") == "model":
                nested_model_count += selection.get("number", 1)
        
        # If we found nested models, use that count; otherwise use the unit's own number
        if nested_model_count > 0:
            return nested_model_count
        else:
            return total_models
    
    def _extract_and_aggregate_weapons(self, unit_selection: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract weapons and aggregate duplicates with proper counts"""
        # First, extract all weapons without aggregation
        all_weapons = self._extract_weapons(unit_selection)
        
        # Aggregate weapons by name and stats
        weapon_map = {}
        
        for weapon in all_weapons:
            # Create a key based on weapon name and core stats
            base_name = weapon['name'].split(' (x')[0]  # Remove existing count if present
            weapon_key = f"{base_name}_{weapon['attacks']}_{weapon['strength']}_{weapon['ap']}_{weapon['damage']}"
            
            if weapon_key in weapon_map:
                # Weapon already exists, increment count in name
                existing_weapon = weapon_map[weapon_key]
                # Extract current count from name if it exists
                if " (x" in existing_weapon['name']:
                    try:
                        count_part = existing_weapon['name'].split("x")[1].split(")")[0]
                        current_count = int(count_part)
                        new_count = current_count + 1
                    except (ValueError, IndexError):
                        new_count = 2
                else:
                    new_count = 2
                
                existing_weapon['name'] = f"{base_name} (x{new_count})"
            else:
                # New weapon, add to map with base name
                weapon_copy = weapon.copy()
                weapon_copy['name'] = base_name
                weapon_map[weapon_key] = weapon_copy
        
        return list(weapon_map.values())
    
    def _extract_weapon_stats_from_profile(self, weapon_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Extract weapon stats directly from weapon profile characteristics"""
        weapon_name = weapon_profile.get("name", "Unknown Weapon")
        
        # Default weapon stats - numeric values default to 0
        weapon = {
            "name": weapon_name,
            "range": "Melee",
            "type": "MELEE",
            "attacks": "1",
            "skill": 0,
            "strength": 0,
            "ap": 0,
            "damage": "1"
        }
        
        # Extract stats from characteristics
        characteristics = weapon_profile.get("characteristics", [])
        for char in characteristics:
            char_name = char.get("name", "").lower()
            char_value = char.get("$text", "")  # Use $text not $t
            
            if char_name == "range":
                weapon["range"] = char_value if char_value else "Melee"
                if char_value.lower() != "melee":
                    weapon["type"] = "RANGED"
            elif char_name == "a" or char_name == "attacks":
                weapon["attacks"] = char_value if char_value else "1"
            elif char_name == "ws" or char_name == "weapon skill":
                try:
                    weapon["skill"] = int(char_value.replace("+", ""))
                except:
                    weapon["skill"] = 4
            elif char_name == "bs" or char_name == "ballistic skill":
                try:
                    weapon["skill"] = int(char_value.replace("+", ""))
                except:
                    weapon["skill"] = 4
            elif char_name == "s" or char_name == "strength":
                try:
                    weapon["strength"] = int(char_value) if char_value.isdigit() else 4
                except:
                    weapon["strength"] = 4
            elif char_name == "ap" or char_name == "armour penetration":
                try:
                    # Handle negative AP values like "-1"
                    if char_value.startswith("-"):
                        weapon["ap"] = int(char_value)
                    else:
                        ap_val = char_value.replace("-", "").replace("+", "")
                        weapon["ap"] = -int(ap_val) if ap_val.isdigit() else 0
                except:
                    weapon["ap"] = 0
            elif char_name == "d" or char_name == "damage":
                weapon["damage"] = char_value if char_value else "1"
        
        # Determine weapon type from name and range if not already set
        if weapon["type"] == "MELEE" and weapon["range"].lower() != "melee":
            weapon["type"] = self._determine_weapon_type(weapon_name, weapon["range"])
        
        return weapon
    
    def extract_weapon_stats(self, weapon_data):
        """Extract weapon statistics from BattleScribe weapon data"""
        weapon = {
            "name": weapon_data.get("name", "Unknown Weapon"),
            "range": "Melee",
            "type": "MELEE",
            "attacks": "1",
            "skill": 0,
            "strength": 0,
            "ap": 0,
            "damage": "1"
        }
        
        # Extract stats from profiles
        if "profiles" in weapon_data:
            for profile in weapon_data["profiles"]:
                if "characteristics" in profile:
                    chars = profile["characteristics"]
                    for char in chars:
                        char_name = char.get("name", "").lower()
                        char_value = char.get("$text", "")  # Use $text not $t
                        
                        if char_name == "range":
                            weapon["range"] = char_value if char_value else "Melee"
                            if char_value.lower() != "melee":
                                weapon["type"] = "RANGED"
                        elif char_name == "a" or char_name == "attacks":
                            weapon["attacks"] = char_value if char_value else "1"
                        elif char_name == "ws" or char_name == "weapon skill":
                            try:
                                weapon["skill"] = int(char_value.replace("+", ""))
                            except:
                                weapon["skill"] = 0
                        elif char_name == "bs" or char_name == "ballistic skill":
                            try:
                                weapon["skill"] = int(char_value.replace("+", ""))
                            except:
                                weapon["skill"] = 0
                        elif char_name == "s" or char_name == "strength":
                            try:
                                weapon["strength"] = int(char_value) if char_value.isdigit() else 0
                            except:
                                weapon["strength"] = 0
                        elif char_name == "ap" or char_name == "armour penetration":
                            try:
                                ap_val = char_value.replace("-", "").replace("+", "")
                                weapon["ap"] = -int(ap_val) if ap_val.isdigit() else 0
                            except:
                                weapon["ap"] = 0
                        elif char_name == "d" or char_name == "damage":
                            weapon["damage"] = char_value if char_value else "1"
        
        return weapon
    
    def _determine_weapon_type(self, weapon_name: str, weapon_range: str) -> str:
        """Determine weapon type from name and range."""
        name_lower = weapon_name.lower()
        
        if weapon_range.lower() == "melee":
            return "MELEE"
        elif "pistol" in name_lower:
            return "PISTOL"
        elif "rifle" in name_lower or "gun" in name_lower:
            return "RIFLE"
        elif "cannon" in name_lower or "launcher" in name_lower:
            return "HEAVY"
        else:
            return "RANGED"

def main():
    """Main function for command-line usage."""
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python battlescribe_converter.py <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    converter = BattleScribeConverter()
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            battlescribe_data = json.load(f)
        
        army_data = converter.convert_battlescribe_to_army(battlescribe_data)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(army_data, f, indent=2)
        
        print(f"Successfully converted {input_file} to {output_file}")
        print(f"Army: {army_data['name']}")
        print(f"Units: {len(army_data['units'])}")
        
    except Exception as e:
        print(f"Error converting file: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
