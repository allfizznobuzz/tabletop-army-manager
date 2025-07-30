import pytest
import json
from army_loader import ArmyLoader
from army_document import ArmyDocument

def test_load_army_from_json(tmp_path):
    """Test loading army from JSON file."""
    test_data = {
        "name": "Test Army",
        "units": [
            {
                "name": "Test Unit",
                "type": "INFANTRY",
                "models": 5,
                "wounds": 10,
                "weapons": [
                    {
                        "name": "Bolt Rifle",
                        "range": "24",
                        "type": "RIFLE"
                    }
                ]
            }
        ]
    }
    
    # Create temporary JSON file
    json_path = tmp_path / "test_army.json"
    with open(json_path, 'w') as f:
        json.dump(test_data, f)
    
    loader = ArmyLoader()
    army = loader.load_army(str(json_path))
    
    assert isinstance(army, ArmyDocument)
    assert army.name == "Test Army"
    assert len(army.units) == 1
    assert army.units[0].name == "Test Unit"

def test_load_invalid_json(tmp_path):
    """Test loading invalid JSON file."""
    # Create invalid JSON file
    json_path = tmp_path / "invalid.json"
    with open(json_path, 'w') as f:
        f.write("{invalid json}")
    
    loader = ArmyLoader()
    with pytest.raises(ValueError):
        loader.load_army(str(json_path))

def test_load_nonexistent_file():
    """Test loading non-existent file."""
    loader = ArmyLoader()
    with pytest.raises(FileNotFoundError):
        loader.load_army("nonexistent.json")
