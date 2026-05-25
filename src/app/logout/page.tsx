"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await signOut(auth);
        // ログアウトに成功したらログイン画面へ
        router.push("/login");
      } catch (error) {
        console.error("Logout Error:", error);
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Logging out...</p>
      </div>
    </div>
  );
}