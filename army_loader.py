import json
from typing import Dict, Any
from army_document import ArmyDocument

class ArmyLoader:
    def load_army(self, file_path: str) -> ArmyDocument:
        """
        Load an army document from a JSON file.
        
        Args:
            file_path: Path to the JSON file containing army data
            
        Returns:
            ArmyDocument: The parsed army document
            
        Raises:
            FileNotFoundError: If the file does not exist
            ValueError: If the JSON is invalid or doesn't contain proper army data
        """
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                return ArmyDocument(data)
        except FileNotFoundError:
            raise
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON file: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error loading army document: {str(e)}")
