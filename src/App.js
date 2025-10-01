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

function GameSessionRoute({ user }) {
  const { id } = useParams();
  return <GameSession gameId={id} user={user} />;
}

function AppRoutes({ user, onSignOut, currentGameId, setCurrentGameId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const isGame = location.pathname.startsWith("/game/");

  const joinGame = (gameId) => {
    setCurrentGameId(gameId);
    navigate(`/game/${gameId}`);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎲 Tabletop Army Manager</h1>
        <div className="user-info">
          <span>Welcome, {user.displayName}</span>
          <ThemeToggle />
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
            element={<GameDashboard user={user} onJoinGame={joinGame} />}
          />
          <Route path="/game/:id" element={<GameSessionRoute user={user} />} />
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
        />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
