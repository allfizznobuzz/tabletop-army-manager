# Tabletop Army Manager

A web-based real-time multiplayer application for managing tabletop wargaming armies, tracking combat, and managing game sessions using Firebase.

## Features

- **Real-time Multiplayer**: Live game sessions with instant updates
- **Army Management**: Load armies from JSON files or BattleScribe format
- **Combat System**: Calculate damage, track wounds, assign victory points
- **Turn Management**: Automated turn tracking with real-time notifications
- **Authentication**: Google Sign-In and email/password options
- **Cloud Storage**: Armies and game data stored in Firebase
- **Offline Support**: Continue playing when internet connection drops

## Quick Start

### Prerequisites
- Node.js 16+ installed
- Firebase CLI: `npm install -g firebase-tools`

### Setup
1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd tabletop-army-manager
   npm install
   ```

2. **Set up Firebase**:
   ```bash
   firebase login
   firebase init
   ```

3. **Update Firebase config** in `src/firebase/config.js` with your project details

4. **Start development**:
   ```bash
   npm run firebase:emulators  # Terminal 1
   npm start                   # Terminal 2
   ```

### Deploy to Production
```bash
npm run firebase:deploy
```

## Usage

1. **Sign in** with Google or create an account
2. **Create armies** by uploading JSON files or using the army builder
3. **Start a game** and invite friends via game ID
4. **Play in real-time** with automatic updates across all devices

## Project Structure

### Frontend (React)
- `src/firebase/` - Firebase configuration and database operations
- `src/components/` - React components
- `src/hooks/` - Custom React hooks

### Legacy Desktop Code (Reference)
- `army_loader.py` - Army data loading (migrated to Firebase functions)
- `combat_mechanics.py` - Combat calculations (migrated to client-side)
- `turn_tracker.py` - Turn management (migrated to Firebase)
- `tests/` - Test suite for legacy code

### Firebase Configuration
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules
- `storage.rules` - File upload security

## Testing

```bash
# Run React tests
npm test

# Run legacy Python tests
pytest
```

## Cost

- **Development**: Free (Firebase emulators)
- **Production**: $0-2/month (Firebase free tier covers typical gaming group usage)
