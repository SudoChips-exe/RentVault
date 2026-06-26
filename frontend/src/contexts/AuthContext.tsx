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

      if (fUser) {
        // Sync user profile from Firestore in real-time
        const userRef = doc(db, 'users', fUser.uid);
        
        // Listen to the user document changes in Firestore
        const unsubscribeSnap = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            setUser({ uid: fUser.uid, ...snapshot.data() } as UserProfile);
            setLoading(false);
          } else {
            // Profile doesn't exist, create default tenant profile
            const newProfile: Omit<UserProfile, 'uid'> = {
              email: fUser.email || '',
              displayName: fUser.displayName || 'Demo User',
              role: 'tenant', // default role
              nombaAccountId: 'ACC-MOCK-LANDLORD-' + fUser.uid.substring(0, 5).toUpperCase(), // Seed standard mock id
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
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('[AUTH_CONTEXT] Google sign-in failed:', error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[AUTH_CONTEXT] Sign-out failed:', error);
    } finally {
      setLoading(false);
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
