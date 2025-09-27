import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "./config";
import { createUser } from "./database";

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Sign up with email and password
export const signUpWithEmail = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // Update profile with display name
    await updateProfile(user, { displayName });

    // Create user document in Firestore
    await createUser(user.uid, {
      email: user.email,
      displayName: displayName,
      photoURL: user.photoURL,
      provider: "email",
    });

    return user;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Sign in with email and password
export const signInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    // Force redirect for Vivaldi (or via env flag), since popups are often blocked
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isVivaldi = /Vivaldi/i.test(ua);
    const envForce =
      String(process.env.REACT_APP_AUTH_FORCE_REDIRECT || "").toLowerCase() ===
      "true";

    // Encourage account chooser each time
    googleProvider.setCustomParameters({ prompt: "select_account" });

    if (isVivaldi || envForce) {
      await signInWithRedirect(auth, googleProvider);
      return null; // continue after redirect
    }

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    // Create or update user document in Firestore (popup path)
    await createUser(user.uid, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: "google",
    });
    return user;
  } catch (error) {
    // Popup blocked or closed? Fallback to redirect which works across strict blockers
    const code = error?.code || "";
    const msg = error?.message || "";
    const isPopupIssue = code.includes("popup") || /popup/i.test(msg);
    if (isPopupIssue) {
      await signInWithRedirect(auth, googleProvider);
      return null; // flow will continue after redirect
    }
    throw new Error(error.message);
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(error.message);
  }
};

// Auth state observer
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};
