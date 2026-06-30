import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'tenant' | 'landlord' | 'agent' | 'admin';
  displayName: string;
  nombaAccountId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: 'tenant' | 'landlord' | 'agent' | 'admin') => Promise<void>;
  updateNombaAccount: (accountId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    console.log('AuthContext - Firebase User:', firebaseUser);
    console.log('AuthContext - User Profile:', user);
  }, [firebaseUser, user]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (fUser) {
        const userRef = doc(db, 'users', fUser.uid);

        const unsubscribeSnap = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            setUser({ uid: fUser.uid, ...snapshot.data() } as UserProfile);
            setLoading(false);
          } else {
            // New user — create a default tenant profile
            const newProfile: Omit<UserProfile, 'uid'> = {
              email: fUser.email || '',
              displayName: fUser.displayName || fUser.email?.split('@')[0] || '',
              role: 'tenant',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, newProfile);
            setUser({ uid: fUser.uid, ...newProfile } as UserProfile);
            setLoading(false);
          }
        }, (error) => {
          console.error('[AUTH_CONTEXT] Firestore profile snapshot error:', error);
          setLoading(false);
        });

        return () => unsubscribeSnap();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('[AUTH_CONTEXT] Google sign-in failed:', error);
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setFirebaseUser(null);
      await signOut(auth);
    } catch (error) {
      console.error('[AUTH_CONTEXT] Sign-out failed:', error);
    }
  };

  const switchRole = async (role: 'tenant' | 'landlord' | 'agent' | 'admin') => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        role,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[AUTH_CONTEXT] Failed to switch role:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNombaAccount = async (accountId: string) => {
    if (!firebaseUser) return;
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        nombaAccountId: accountId,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[AUTH_CONTEXT] Failed to update Nomba account:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signingIn,
        signInWithGoogle,
        logout,
        switchRole,
        updateNombaAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
