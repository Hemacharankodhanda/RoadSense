import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);
const STORAGE_KEY = 'roadsense_authority_session';

export function AuthProvider({ children }) {
  // Check local storage for quick bypass session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.user;
      }
    } catch (e) {
      // ignore
    }
    return null;
  });

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.profile;
      }
    } catch (e) {
      // ignore
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If we already have an active local bypass session, keep it
    if (currentUser && userProfile?.role === 'authority') {
      setLoading(false);
      return;
    }

    let unsubscribeDoc = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile({ uid: user.uid, email: user.email, ...docSnap.data() });
            } else {
              setUserProfile({
                uid: user.uid,
                email: user.email,
                role: 'authority', // Default to authority for direct ease of use
                name: user.displayName || user.email.split('@')[0]
              });
            }
            setLoading(false);
          },
          (error) => {
            setUserProfile({
              uid: user.uid,
              email: user.email,
              role: 'authority'
            });
            setLoading(false);
          }
        );
      } else {
        if (!localStorage.getItem(STORAGE_KEY)) {
          setCurrentUser(null);
          setUserProfile(null);
        }
        unsubscribeDoc();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDoc();
    };
  }, []);

  /**
   * Login handler: Accepts any credentials or random input,
   * immediately grants access as an authorized municipal official.
   */
  const login = async (email, password) => {
    const cleanEmail = email?.trim() || 'officer@city.gov';
    const cleanName = cleanEmail.split('@')[0] || 'Municipal Officer';
    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    const officerUser = {
      uid: 'officer_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      displayName: formattedName
    };

    const profile = {
      uid: officerUser.uid,
      email: cleanEmail,
      name: formattedName,
      role: 'authority', // Automatically granted authority role
      department: 'Municipal Public Works & Infrastructure',
      loggedInAt: new Date().toISOString()
    };

    // Save session locally so user remains logged in across refreshes
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: officerUser, profile }));
    setCurrentUser(officerUser);
    setUserProfile(profile);

    // Optional background sync with Firebase Auth if configured
    try {
      if (email && password && email.includes('@')) {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      // Ignored: bypass authentication allows any credentials!
    }

    return { user: officerUser, profile };
  };

  const logout = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
    setUserProfile(null);
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
  };

  const isAuthority = userProfile?.role === 'authority' || Boolean(currentUser);

  const value = {
    currentUser,
    userProfile,
    isAuthority,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
