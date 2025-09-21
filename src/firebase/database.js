import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './config';

// Database structure based on your existing army manager requirements
export const DATABASE_COLLECTIONS = {
  USERS: 'users',
  ARMIES: 'armies',
  GAMES: 'games',
  ARMY_TEMPLATES: 'armyTemplates'
};

// User Management
export const createUser = async (userId, userData) => {
  const userRef = doc(db, DATABASE_COLLECTIONS.USERS, userId);
  await updateDoc(userRef, {
    ...userData,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp()
  });
};

export const getUser = async (userId) => {
  const userRef = doc(db, DATABASE_COLLECTIONS.USERS, userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
};

// Army Management
export const createArmy = async (userId, armyData) => {
  const armyRef = await addDoc(collection(db, DATABASE_COLLECTIONS.ARMIES), {
    ...armyData,
    ownerId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return armyRef.id;
};

// Get user's games
export const getUserGames = async (userId) => {
  try {
    const gamesRef = collection(db, DATABASE_COLLECTIONS.GAMES);
    const q = query(gamesRef, where('players', 'array-contains', userId));
    const querySnapshot = await getDocs(q);
    
    const games = [];
    querySnapshot.forEach((doc) => {
      games.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return games;
  } catch (error) {
    console.error('Error getting games:', error);
    throw error;
  }
};

export const getUserArmies = async (userId) => {
  try {
    const armiesRef = collection(db, DATABASE_COLLECTIONS.ARMIES);
    const q = query(armiesRef, where('ownerId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const armies = [];
    querySnapshot.forEach((doc) => {
      armies.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return armies;
  } catch (error) {
    console.error('Error getting armies:', error);
    throw error;
  }
};

export const updateArmy = async (armyId, updates) => {
  const armyRef = doc(db, DATABASE_COLLECTIONS.ARMIES, armyId);
  await updateDoc(armyRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deleteArmy = async (armyId) => {
  const armyRef = doc(db, DATABASE_COLLECTIONS.ARMIES, armyId);
  await deleteDoc(armyRef);
};

// Game Session Management
export const createGame = async (gameData) => {
  const gameRef = await addDoc(collection(db, DATABASE_COLLECTIONS.GAMES), {
    ...gameData,
    status: 'waiting', // waiting, active, completed
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    currentTurn: 0,
    round: 1
  });
  return gameRef.id;
};

export const joinGame = async (gameId, userId, armyId) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  await updateDoc(gameRef, {
    players: arrayUnion(userId),
    [`playerArmies.${userId}`]: armyId,
    updatedAt: serverTimestamp()
  });
};

export const updateGameState = async (gameId, updates) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  await updateDoc(gameRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deleteGame = async (gameId) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  await deleteDoc(gameRef);
};

// Real-time game updates
export const subscribeToGame = (gameId, callback) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  return onSnapshot(gameRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    }
  });
};

// Combat and Damage Tracking
export const assignDamage = async (gameId, targetUnitId, damage, attackerId = null) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  const updateData = {
    [`gameState.units.${targetUnitId}.currentWounds`]: damage.remainingWounds,
    [`gameState.units.${targetUnitId}.totalDamage`]: damage.totalDamage,
    updatedAt: serverTimestamp()
  };

  // Add to damage history
  const damageRecord = {
    id: `damage_${Date.now()}`,
    targetUnitId,
    attackerId,
    damage: damage.damageDealt,
    timestamp: serverTimestamp(),
    type: 'damage'
  };

  updateData[`gameState.damageHistory.${damageRecord.id}`] = damageRecord;

  await updateDoc(gameRef, updateData);
  
  // Add real-time update
  await addGameUpdate(gameId, {
    type: 'damage',
    targetUnitId,
    attackerId,
    damage: damage.damageDealt,
    playerId: attackerId
  });
};

// Victory Points Management
export const assignVictoryPoints = async (gameId, playerId, points, reason) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  const vpRecord = {
    id: `vp_${Date.now()}`,
    playerId,
    points,
    reason,
    timestamp: serverTimestamp(),
    type: 'victory_points'
  };

  await updateDoc(gameRef, {
    [`gameState.victoryPoints.${playerId}`]: arrayUnion(vpRecord),
    [`gameState.totalVP.${playerId}`]: (await getGameVP(gameId, playerId)) + points,
    updatedAt: serverTimestamp()
  });

  await addGameUpdate(gameId, {
    type: 'victory_points',
    playerId,
    points,
    reason
  });
};

// Turn Management
export const nextTurn = async (gameId) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (gameSnap.exists()) {
    const gameData = gameSnap.data();
    const nextTurnIndex = (gameData.currentTurn + 1) % gameData.players.length;
    const nextRound = nextTurnIndex === 0 ? gameData.round + 1 : gameData.round;
    
    await updateDoc(gameRef, {
      currentTurn: nextTurnIndex,
      round: nextRound,
      updatedAt: serverTimestamp()
    });

    await addGameUpdate(gameId, {
      type: 'turn_change',
      currentPlayer: gameData.players[nextTurnIndex],
      round: nextRound
    });
  }
};

// Real-time updates subcollection
export const addGameUpdate = async (gameId, updateData) => {
  const updatesRef = collection(db, DATABASE_COLLECTIONS.GAMES, gameId, 'updates');
  await addDoc(updatesRef, {
    ...updateData,
    timestamp: serverTimestamp()
  });
};

export const subscribeToGameUpdates = (gameId, callback) => {
  const updatesRef = collection(db, DATABASE_COLLECTIONS.GAMES, gameId, 'updates');
  const q = query(updatesRef, orderBy('timestamp', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const updates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(updates);
  });
};

// Helper functions
const getGameVP = async (gameId, playerId) => {
  const gameRef = doc(db, DATABASE_COLLECTIONS.GAMES, gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (gameSnap.exists()) {
    const gameData = gameSnap.data();
    return gameData.gameState?.totalVP?.[playerId] || 0;
  }
  return 0;
};

// Army Templates (for sharing armies)
export const createArmyTemplate = async (userId, armyData, isPublic = false) => {
  const templateRef = await addDoc(collection(db, DATABASE_COLLECTIONS.ARMY_TEMPLATES), {
    ...armyData,
    createdBy: userId,
    isPublic,
    createdAt: serverTimestamp(),
    downloads: 0
  });
  return templateRef.id;
};

export const getPublicArmyTemplates = async () => {
  const q = query(
    collection(db, DATABASE_COLLECTIONS.ARMY_TEMPLATES),
    where('isPublic', '==', true),
    orderBy('downloads', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
