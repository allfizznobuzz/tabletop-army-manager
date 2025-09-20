import React, { useState, useEffect } from 'react';
import { onAuthStateChange, signInWithGoogle, signOutUser } from './firebase/auth';
import { subscribeToGame } from './firebase/database';
import ArmyManager from './components/ArmyManager';
import GameSession from './components/GameSession';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('armies'); // 'armies', 'game'
  const [currentGameId, setCurrentGameId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentView('armies');
      setCurrentGameId(null);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const joinGame = (gameId) => {
    setCurrentGameId(gameId);
    setCurrentView('game');
  };

  if (loading) {
    return (
      <div className="app-loading">
        <h2>Loading Tabletop Army Manager...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-signin">
        <div className="signin-container">
          <h1>🎲 Tabletop Army Manager</h1>
          <p>Real-time multiplayer army management for tabletop gaming</p>
          <button onClick={handleSignIn} className="signin-button">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎲 Tabletop Army Manager</h1>
        <div className="user-info">
          <span>Welcome, {user.displayName}</span>
          <button onClick={handleSignOut} className="signout-button">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <button 
          onClick={() => setCurrentView('armies')}
          className={currentView === 'armies' ? 'active' : ''}
        >
          My Armies
        </button>
        {currentGameId && (
          <button 
            onClick={() => setCurrentView('game')}
            className={currentView === 'game' ? 'active' : ''}
          >
            Current Game
          </button>
        )}
      </nav>

      <main className="app-main">
        {currentView === 'armies' && (
          <ArmyManager user={user} onJoinGame={joinGame} />
        )}
        {currentView === 'game' && currentGameId && (
          <GameSession gameId={currentGameId} user={user} />
        )}
      </main>
    </div>
  );
}

export default App;
