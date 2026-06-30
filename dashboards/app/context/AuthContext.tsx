'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'tenant' | 'landlord' | 'agent' | 'admin';
  displayName: string;
  nombaAccountId?: string;
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (!fUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', fUser.uid);
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setUser({ uid: fUser.uid, ...snap.data() } as UserProfile);
        } else {
          const newProfile = {
            email: fUser.email || '',
            displayName: fUser.displayName || fUser.email?.split('@')[0] || '',
            role: 'tenant' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setUser({ uid: fUser.uid, ...newProfile });
        }
      } catch (e) {
        console.error('Error fetching initial profile:', e);
      } finally {
        setLoading(false);
      }

      const unsubSnap = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUser({ uid: fUser.uid, ...snap.data() } as UserProfile);
        }
      });

      return () => unsubSnap();
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    try {
      setUser(null);
      setFirebaseUser(null);
      await signOut(auth);
      window.location.href = '/'; // Redirect to landing page after logout
    } catch (error) {
      console.error('[AUTH_CONTEXT] Sign-out failed:', error);
    }
  };

  const switchRole = async (role: 'tenant' | 'landlord' | 'agent' | 'admin') => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), { role, updatedAt: serverTimestamp() });
  };

  const updateNombaAccount = async (accountId: string) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      nombaAccountId: accountId,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, logout, switchRole, updateNombaAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
