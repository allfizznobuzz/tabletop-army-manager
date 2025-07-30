#!/usr/bin/env python3
"""
Main entry point for Tabletop Army Manager
Generic miniature game combat assistant with:
- No copyrighted references
- Instant dice calculation updates
- Total dice count display
- Robust JSON ingestion
"""

import sys
from PySide6.QtWidgets import QApplication
from tabletop_army_manager import TabletopArmyManager


def main():
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("Tabletop Army Manager")
    app.setApplicationVersion("3.0")
    app.setOrganizationName("Generic Gaming Tools")
    
    # Create and show main window
    window = TabletopArmyManager()
    window.show()
    
    # Run the application
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
