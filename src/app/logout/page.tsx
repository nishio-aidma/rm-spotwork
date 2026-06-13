"use client";

import { useEffect, useRef } from "react"; // 💡 useRef を追加
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  const hasRun = useRef(false); // 💡 2回連続で処理が走ってフリーズするのを防ぐ絶対防壁

  useEffect(() => {
    // すでに1回目が走っていたら、2回目の進入を完全にシャットアウト
    if (hasRun.current) return;
    hasRun.current = true;

    const performLogout = async () => {
      try {
        // Firebaseのサインアウトを一度だけ確実に実行
        await signOut(auth);
        
        // 💡 履歴を残さない router.replace で、綺麗にログイン画面へ着地させる
        router.replace("/login");
      } catch (error) {
        console.error("Logout Error:", error);
        // 万が一エラーが起きても、画面が固まらないようにログインへ強制送還する安全弁
        router.replace("/login");
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