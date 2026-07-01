'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  verificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected';
  verificationDocuments?: {
    idDocumentUrl?: string;
    incomeProofUrl?: string;
  };
  verificationRejectionReason?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signingIn: boolean;
  signInWithGoogle: (intendedRole?: 'tenant' | 'landlord') => Promise<void>;
  logout: () => Promise<void>;
  updateNombaAccount: (accountId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const intendedRoleRef = useRef<'tenant' | 'landlord'>('tenant');

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
            // Role is chosen once at signup (see intendedRoleRef) and is
            // permanently locked afterward - see firestore.rules.
            role: intendedRoleRef.current,
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

  const signInWithGoogle = async (intendedRole: 'tenant' | 'landlord' = 'tenant') => {
    intendedRoleRef.current = intendedRole;
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
    console.log('[AUTH_CONTEXT] logout called');
    try {
      await signOut(auth);
      console.log('[AUTH_CONTEXT] signOut successful');
      setUser(null);
      setFirebaseUser(null);
      window.location.href = '/'; // Redirect to landing page after logout
    } catch (error) {
      console.error('[AUTH_CONTEXT] Sign-out failed:', error);
    }
  };

  const updateNombaAccount = async (accountId: string) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      nombaAccountId: accountId,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signingIn, signInWithGoogle, logout, updateNombaAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
