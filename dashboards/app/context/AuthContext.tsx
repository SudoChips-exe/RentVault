'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: 'tenant' | 'landlord' | 'agent' | 'admin') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      if (!fUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', fUser.uid);
      const unsubSnap = onSnapshot(userRef, async (snap) => {
        if (snap.exists()) {
          setUser({ uid: fUser.uid, ...snap.data() } as UserProfile);
          setLoading(false);
        } else {
          const newProfile = {
            email: fUser.email || '',
            displayName: fUser.displayName || 'New User',
            role: 'tenant' as const,
            nombaAccountId: `ACC-MOCK-${fUser.uid.substring(0, 6).toUpperCase()}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setUser({ uid: fUser.uid, ...newProfile });
          setLoading(false);
        }
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const switchRole = async (role: 'tenant' | 'landlord' | 'agent' | 'admin') => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), { role, updatedAt: serverTimestamp() });
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
