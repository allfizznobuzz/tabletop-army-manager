import React, { useState, useEffect } from "react";
import {
  onAuthStateChange,
  signInWithGoogle,
  signOutUser,
} from "./firebase/auth";
import { createUser } from "./firebase/database";
import GameDashboard from "pages/GameDashboard";
import GameSession from "pages/GameSession";
import ThemeToggle from "components/ThemeToggle";
import { ThemeProvider } from "contexts/ThemeContext";
import "./App.css";
import "./styles/themes.css";
import { goOffline, goOnline } from "./firebase/config";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  Link,
  useLocation,
} from "react-router-dom";

function GameSessionRoute({ user, offline }) {
  const { id } = useParams();
  const location = useLocation();
  const gameDataFromState = location.state?.gameData;
  return (
    <GameSession
      gameId={id}
      user={user}
      gameData={gameDataFromState}
      offline={offline}
    />
  );
}

function AppRoutes({
  user,
  onSignOut,
  currentGameId,
  setCurrentGameId,
  offline,
  setOffline,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const isGame = location.pathname.startsWith("/game/");

  const joinGame = (gameId, options) => {
    setCurrentGameId(gameId);
    navigate(`/game/${gameId}`, { state: options });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎲 Tabletop Army Manager</h1>
        <div className="user-info">
          <span>Welcome, {user.displayName}</span>
          <ThemeToggle />
          <button
            onClick={() => {
              const next = !offline;
              setOffline(next);
              try {
                localStorage.setItem("tam_offline", next ? "1" : "0");
              } catch (_) {}
              // Flip Firestore network state
              if (next) {
                goOffline();
              } else {
                goOnline();
              }
            }}
            className={`signout-button`}
            title={offline ? "Working Offline" : "Go Offline"}
          >
            {offline ? "Offline" : "Go Offline"}
          </button>
          <button onClick={onSignOut} className="signout-button">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <Link to="/" className={isDashboard ? "active" : ""}>
          Game Dashboard
        </Link>
        {currentGameId && (
          <Link
            to={`/game/${currentGameId}`}
            className={isGame ? "active" : ""}
          >
            Current Game
          </Link>
        )}
      </nav>

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <GameDashboard
                user={user}
                onJoinGame={joinGame}
                offline={offline}
              />
            }
          />
          <Route
            path="/game/:id"
            element={<GameSessionRoute user={user} offline={offline} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentGameId, setCurrentGameId] = useState(null);
  const [offline, setOffline] = useState(() => {
    try {
      return localStorage.getItem("tam_offline") === "1";
    } catch (_) {
      return false;
    }
  });

  // Keep a global hint for non-routed hooks
  useEffect(() => {
    try {
      window.__TAM_OFFLINE__ = offline;
    } catch (_) {}
  }, [offline]);

  // Apply initial network state on mount
  useEffect(() => {
    if (offline) goOffline();
  }, [offline]);

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
  }, [user]);

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
      setCurrentGameId(null);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
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
      <BrowserRouter>
        <AppRoutes
          user={user}
          onSignOut={handleSignOut}
          currentGameId={currentGameId}
          setCurrentGameId={setCurrentGameId}
          offline={offline}
          setOffline={setOffline}
        />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
