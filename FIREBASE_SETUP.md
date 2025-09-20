# Firebase Setup Guide - Tabletop Army Manager

## Quick Start (5 minutes)

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Create Firebase Project
```bash
# Initialize Firebase in your project directory
firebase init

# Select these services:
# ✅ Firestore: Configure security rules and indexes
# ✅ Functions: Configure a Cloud Functions directory
# ✅ Hosting: Configure files for Firebase Hosting
# ✅ Storage: Configure a security rules file for Cloud Storage
# ✅ Emulators: Set up local emulators
```

### 4. Update Firebase Config
Edit `src/firebase/config.js` with your project details from Firebase Console:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 5. Install Dependencies & Start Development
```bash
npm install
npm run firebase:emulators  # Start Firebase emulators
npm start                   # Start React app (in another terminal)
```

## Database Structure

Your Firestore database will have these collections:

### Users Collection
```javascript
/users/{userId}
{
  email: "user@example.com",
  displayName: "John Doe",
  photoURL: "https://...",
  provider: "google",
  createdAt: timestamp,
  lastActive: timestamp
}
```

### Armies Collection
```javascript
/armies/{armyId}
{
  name: "Blood Angels Strike Force",
  faction: "Space Marines",
  ownerId: "user123",
  units: [
    {
      id: "unit1",
      name: "Tactical Squad",
      type: "INFANTRY",
      models: 10,
      wounds: 1,
      currentWounds: 1,
      weapons: [...]
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Games Collection
```javascript
/games/{gameId}
{
  name: "Friday Night Battle",
  players: ["user1", "user2"],
  playerArmies: {
    "user1": "armyId1",
    "user2": "armyId2"
  },
  status: "active", // waiting, active, completed
  currentTurn: 0,
  round: 1,
  gameState: {
    units: {...},
    damageHistory: {...},
    victoryPoints: {...},
    totalVP: {
      "user1": 15,
      "user2": 12
    }
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Real-time Updates Subcollection
```javascript
/games/{gameId}/updates/{updateId}
{
  type: "damage", // damage, victory_points, turn_change
  playerId: "user1",
  targetUnitId: "unit123",
  damage: 3,
  timestamp: timestamp
}
```

## Key Features Implemented

### 🔥 Real-time Multiplayer
```javascript
import { subscribeToGame } from './firebase/database';

// Automatically updates when any player makes a move
const unsubscribe = subscribeToGame(gameId, (gameData) => {
  updateGameUI(gameData);
});
```

### 🛡️ Army Management
```javascript
import { createArmy, getUserArmies } from './firebase/database';

// Create new army
const armyId = await createArmy(userId, armyData);

// Get user's armies
const armies = await getUserArmies(userId);
```

### ⚔️ Combat & Damage Tracking
```javascript
import { assignDamage } from './firebase/database';

// Assign damage to a unit
await assignDamage(gameId, targetUnitId, {
  damageDealt: 3,
  remainingWounds: 2,
  totalDamage: 5
}, attackerId);
```

### 🏆 Victory Points
```javascript
import { assignVictoryPoints } from './firebase/database';

// Award victory points
await assignVictoryPoints(gameId, playerId, 5, "Destroyed enemy unit");
```

## Authentication Options

### Google Sign-In (Recommended)
```javascript
import { signInWithGoogle } from './firebase/auth';

const handleGoogleSignIn = async () => {
  try {
    const user = await signInWithGoogle();
    console.log('Signed in:', user.displayName);
  } catch (error) {
    console.error('Sign-in failed:', error.message);
  }
};
```

### Email/Password
```javascript
import { signUpWithEmail, signInWithEmail } from './firebase/auth';

// Sign up
await signUpWithEmail(email, password, displayName);

// Sign in
await signInWithEmail(email, password);
```

## Development Workflow

### Local Development with Emulators
```bash
# Terminal 1: Start Firebase emulators
npm run firebase:emulators

# Terminal 2: Start React app
npm start
```

Access:
- **React App**: http://localhost:3000
- **Firebase UI**: http://localhost:4000
- **Firestore**: http://localhost:8080

### Deploy to Production
```bash
npm run firebase:deploy
```

## Cost Estimate

### Firebase Free Tier (Generous!)
- **Firestore**: 50K reads, 20K writes, 20K deletes per day
- **Authentication**: 50K MAU (Monthly Active Users)
- **Hosting**: 10GB storage, 360MB/day transfer
- **Storage**: 5GB storage, 1GB/day downloads
- **Functions**: 125K invocations, 40K GB-seconds

### Typical Usage for Gaming Group
- **4 players, 3 hours/week**: Well within free tier
- **Monthly cost**: $0 for first year, $1-3 after

## Security Rules

Your Firestore security rules ensure:
- ✅ Users can only edit their own armies
- ✅ Game participants can read/write game data
- ✅ Public army templates are readable by all
- ✅ Real-time updates are restricted to game participants

## Next Steps

1. **Set up Firebase project** (5 minutes)
2. **Update config with your project details**
3. **Start building React components**
4. **Test with Firebase emulators**
5. **Deploy when ready**

## Migration from Desktop App

Your existing Python logic can be easily adapted:

```javascript
// Your existing army_loader.py logic
const loadArmy = async (armyData) => {
  // Convert BattleScribe format if needed
  const processedArmy = convertBattleScribeFormat(armyData);
  
  // Save to Firebase
  const armyId = await createArmy(userId, processedArmy);
  return armyId;
};

// Your existing combat_mechanics.py logic
const calculateDamage = (attacker, defender, weapon) => {
  // Same combat calculations
  const damage = rollDamage(weapon, defender.toughness);
  
  // Save to Firebase with real-time updates
  await assignDamage(gameId, defender.id, damage, attacker.id);
};
```

Firebase handles all the complexity of real-time sync, offline support, and scaling - you just focus on your game logic!
