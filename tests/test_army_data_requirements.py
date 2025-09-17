"""
Test comprehensive army data requirements and format validation.
Ensures all required fields are properly tested and validated.
"""
import pytest
from army_document import ArmyDocument, Unit, Weapon


def test_minimal_required_army_data():
    """Test that army can be created with minimal required data."""
    minimal_data = {
        "name": "Test Army",
        "units": [
            {
                "name": "Basic Unit",
                "type": "INFANTRY",
                "models": 1,
                "wounds": 1,
                "weapons": []
            }
        ]
    }
    
    army = ArmyDocument(minimal_data)
    assert army.name == "Test Army"
    assert len(army.units) == 1
    
    unit = army.units[0]
    assert unit.name == "Basic Unit"
    assert unit.unit_type == "INFANTRY"
    assert unit.models == 1
    assert unit.wounds == 1
    assert len(unit.weapons) == 0
    
    # Check default combat stats are set
    assert unit.weapon_skill == 4
    assert unit.ballistic_skill == 4
    assert unit.toughness == 4
    assert unit.armor_save == 6
    assert unit.invulnerable_save == 7


def test_complete_army_data_fields():
    """Test army with all possible data fields populated."""
    complete_data = {
        "name": "Complete Test Army",
        "units": [
            {
                "name": "Elite Unit",
                "type": "CHARACTER",
                "models": 1,
                "wounds": 5,
                "weapon_skill": 2,
                "ballistic_skill": 2,
                "toughness": 5,
                "armor_save": 2,
                "invulnerable_save": 4,
                "weapons": [
                    {
                        "name": "Master Crafted Bolt Rifle",
                        "range": "30",
                        "type": "RIFLE",
                        "attacks": "3",
                        "skill": 2,
                        "strength": 5,
                        "ap": -1,
                        "damage": "2"
                    },
                    {
                        "name": "Power Sword",
                        "range": "Melee",
                        "type": "MELEE",
                        "attacks": "4",
                        "skill": 2,
                        "strength": 6,
                        "ap": -2,
                        "damage": "2"
                    }
                ]
            }
        ]
    }
    
    army = ArmyDocument(complete_data)
    assert army.name == "Complete Test Army"
    
    unit = army.units[0]
    assert unit.name == "Elite Unit"
    assert unit.unit_type == "CHARACTER"
    assert unit.models == 1
    assert unit.wounds == 5
    assert unit.weapon_skill == 2
    assert unit.ballistic_skill == 2
    assert unit.toughness == 5
    assert unit.armor_save == 2
    assert unit.invulnerable_save == 4
    
    # Check weapons
    assert len(unit.weapons) == 2
    
    rifle = unit.weapons[0]
    assert rifle.name == "Master Crafted Bolt Rifle"
    assert rifle.range == "30"
    assert rifle.type == "RIFLE"
    assert rifle.attacks == "3"
    assert rifle.skill == 2
    assert rifle.strength == 5
    assert rifle.ap == -1
    assert rifle.damage == "2"
    assert not rifle.fired
    
    sword = unit.weapons[1]
    assert sword.name == "Power Sword"
    assert sword.range == "Melee"
    assert sword.type == "MELEE"
    assert sword.attacks == "4"
    assert sword.skill == 2
    assert sword.strength == 6
    assert sword.ap == -2
    assert sword.damage == "2"
    assert not sword.fired


def test_required_field_validation():
    """Test that missing required fields raise appropriate errors."""
    
    # Missing name
    with pytest.raises(ValueError, match="must contain name and units"):
        ArmyDocument({"units": []})
    
    # Missing units
    with pytest.raises(ValueError, match="must contain name and units"):
        ArmyDocument({"name": "Test"})
    
    # Invalid data type
    with pytest.raises(ValueError, match="must be a dictionary"):
        ArmyDocument("not a dict")
    
    # Test that unit creation works with minimal data (has defaults)
    minimal_unit_data = {
        "name": "Test Army",
        "units": [
            {
                "name": "Unit",
                # Missing type, models, wounds - should use defaults
                "weapons": []
            }
        ]
    }
    
    # This should work because the code provides defaults
    army = ArmyDocument(minimal_unit_data)
    unit = army.units[0]
    assert unit.name == "Unit"
    assert unit.unit_type == "INFANTRY"  # Default
    assert unit.models == 1  # Default
    assert unit.wounds == 1  # Default


def test_weapon_data_validation():
    """Test weapon data requirements and defaults."""
    army_data = {
        "name": "Weapon Test Army",
        "units": [
            {
                "name": "Armed Unit",
                "type": "INFANTRY",
                "models": 1,
                "wounds": 1,
                "weapons": [
                    {
                        "name": "Basic Weapon",
                        "range": "24",
                        "type": "RIFLE"
                        # Test defaults for other fields
                    }
                ]
            }
        ]
    }
    
    army = ArmyDocument(army_data)
    weapon = army.units[0].weapons[0]
    
    # Check required fields
    assert weapon.name == "Basic Weapon"
    assert weapon.range == "24"
    assert weapon.type == "RIFLE"
    
    # Check defaults
    assert weapon.attacks == "1"
    assert weapon.skill == 4
    assert weapon.strength == 4
    assert weapon.ap == 0
    assert weapon.damage == "1"
    assert not weapon.fired


def test_multiple_units_with_varied_data():
    """Test army with multiple units having different data completeness."""
    varied_data = {
        "name": "Mixed Army",
        "units": [
            {
                "name": "Basic Infantry",
                "type": "INFANTRY",
                "models": 10,
                "wounds": 10,
                "weapons": [
                    {
                        "name": "Lasgun",
                        "range": "24",
                        "type": "RIFLE"
                    }
                ]
            },
            {
                "name": "Elite Character",
                "type": "CHARACTER",
                "models": 1,
                "wounds": 4,
                "weapon_skill": 2,
                "ballistic_skill": 2,
                "toughness": 4,
                "armor_save": 3,
                "invulnerable_save": 5,
                "weapons": [
                    {
                        "name": "Plasma Pistol",
                        "range": "12",
                        "type": "PISTOL",
                        "strength": 7,
                        "ap": -3,
                        "damage": "2"
                    },
                    {
                        "name": "Chain Sword",
                        "range": "Melee",
                        "type": "MELEE",
                        "attacks": "2"
                    }
                ]
            },
            {
                "name": "Heavy Support",
                "type": "VEHICLE",
                "models": 1,
                "wounds": 12,
                "toughness": 8,
                "armor_save": 2,
                "weapons": [
                    {
                        "name": "Lascannon",
                        "range": "48",
                        "type": "HEAVY",
                        "strength": 9,
                        "ap": -3,
                        "damage": "D6"
                    }
                ]
            }
        ]
    }
    
    army = ArmyDocument(varied_data)
    assert len(army.units) == 3
    
    # Basic infantry with defaults
    infantry = army.units[0]
    assert infantry.weapon_skill == 4  # Default
    assert infantry.ballistic_skill == 4  # Default
    assert len(infantry.weapons) == 1
    
    # Elite character with custom stats
    character = army.units[1]
    assert character.weapon_skill == 2  # Custom
    assert character.ballistic_skill == 2  # Custom
    assert character.invulnerable_save == 5  # Custom
    assert len(character.weapons) == 2
    
    # Heavy support
    vehicle = army.units[2]
    assert vehicle.toughness == 8  # Custom
    assert vehicle.armor_save == 2  # Custom
    assert vehicle.invulnerable_save == 7  # Default (no invuln)
    assert len(vehicle.weapons) == 1


def test_edge_case_values():
    """Test edge case values for numeric fields."""
    edge_case_data = {
        "name": "Edge Case Army",
        "units": [
            {
                "name": "Extreme Unit",
                "type": "MONSTER",
                "models": 1,
                "wounds": 20,
                "weapon_skill": 2,
                "ballistic_skill": 6,
                "toughness": 10,
                "armor_save": 2,
                "invulnerable_save": 3,
                "weapons": [
                    {
                        "name": "Massive Weapon",
                        "range": "72",
                        "type": "HEAVY",
                        "attacks": "2D6",
                        "strength": 12,
                        "ap": -4,
                        "damage": "D6+3"
                    }
                ]
            }
        ]
    }
    
    army = ArmyDocument(edge_case_data)
    unit = army.units[0]
    weapon = unit.weapons[0]
    
    # Verify extreme values are preserved
    assert unit.wounds == 20
    assert unit.toughness == 10
    assert unit.invulnerable_save == 3
    assert weapon.strength == 12
    assert weapon.ap == -4
    assert weapon.attacks == "2D6"
    assert weapon.damage == "D6+3"
