import React, { useState, useEffect } from "react";
import {
  onAuthStateChange,
  signInWithGoogle,
  signOutUser,
} from "./firebase/auth";
import { createUser } from "./firebase/database";
import GameDashboard from "./components/GameDashboard";
import GameSession from "./components/GameSession";
import ThemeToggle from "./components/ThemeToggle";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./App.css";
import "./styles/themes.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState("dashboard"); // 'dashboard', 'game'
  const [currentGameId, setCurrentGameId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Ensure user document exists after any successful sign-in (popup or redirect)
  useEffect(() => {
    if (!user) return;
    const { uid, email, displayName, photoURL } = user;
    createUser(uid, {
      email,
      displayName,
      photoURL,
      provider: "google",
    }).catch((err) => console.error("Failed to upsert user doc:", err));
  }, [user?.uid]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentView("dashboard");
      setCurrentGameId(null);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const joinGame = (gameId) => {
    setCurrentGameId(gameId);
    setCurrentView("game");
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
    <ThemeProvider>
      <div className="app">
        <header className="app-header">
          <h1>🎲 Tabletop Army Manager</h1>
          <div className="user-info">
            <span>Welcome, {user.displayName}</span>
            <ThemeToggle />
            <button onClick={handleSignOut} className="signout-button">
              Sign Out
            </button>
          </div>
        </header>

        <nav className="app-nav">
          <button
            onClick={() => setCurrentView("dashboard")}
            className={currentView === "dashboard" ? "active" : ""}
          >
            Game Dashboard
          </button>
          {currentGameId && (
            <button
              onClick={() => setCurrentView("game")}
              className={currentView === "game" ? "active" : ""}
            >
              Current Game
            </button>
          )}
        </nav>

        <main className="app-main">
          {currentView === "dashboard" && (
            <GameDashboard user={user} onJoinGame={joinGame} />
          )}
          {currentView === "game" && currentGameId && (
            <GameSession gameId={currentGameId} user={user} />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
