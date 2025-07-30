# Tabletop Army Manager

A generic tabletop miniature game combat assistant that helps speed up gameplay by managing army documents and providing instant combat dice calculations.

## Features

### Core Functionality
- **Army Document Loading**: Load standard JSON files or BattleScribe exports with automatic format detection
- **Combat Calculations**: Instant hit, wound, and save roll calculations with visual dice displays
- **Unit & Weapon Selection**: Interactive selection of attacking units, weapons, and target units
- **AP Calculation**: Accurate armor penetration calculations with auto-fail detection
- **Invulnerable Saves**: Proper handling of invulnerable saves and AP interactions

### User Interface
- **Professional Dark Theme**: Accessible color scheme following WCAG guidelines
- **Visual Dice Display**: Custom dice widgets showing required rolls with color coding
- **Instant Updates**: Real-time calculation updates when selecting weapons and targets
- **Clear Combat Feedback**: Detailed explanations of dice roll requirements

### Technical Features
- **BattleScribe Integration**: Robust conversion from BattleScribe JSON format
- **Cross-Platform**: Built with PySide6 for Windows, macOS, and Linux
- **Clean Architecture**: Well-organized, maintainable codebase with comprehensive documentation
- **Test Coverage**: Comprehensive test suite for reliability

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python main_tabletop.py
```

## Testing

Run tests using pytest:
```bash
pytest
```

## Project Structure

- `src/`: Source code
- `tests/`: Test files
- `assets/`: Application assets (icons, images)
- `docs/`: Documentation
