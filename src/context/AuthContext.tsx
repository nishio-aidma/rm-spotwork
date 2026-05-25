"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import type { UserRole } from "@/types";

type AuthContextValue = {
  user: FirebaseUser | null;
  role: UserRole | null;
  displayName: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUserProfile(uid: string): Promise<{
  role: UserRole | null;
  displayName: string | null;
}> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return { role: null, displayName: null };

  const data = snap.data();
  const role = data.role;
  const validRole =
    role === "owner" || role === "worker" ? (role as UserRole) : null;
  const name =
    typeof data.displayName === "string" ? data.displayName : null;

  return { role: validRole, displayName: name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        setRole(profile.role);
        setDisplayName(profile.displayName);
      } else {
        setRole(null);
        setDisplayName(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    },
    [router],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setRole(null);
    setDisplayName(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, role, displayName, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
