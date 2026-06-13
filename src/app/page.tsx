"use client";

import { useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            router.push(`/${role}/dashboard`);
            return;
          }
        } catch (err) {
          console.error("ルート自動振分エラー:", err);
        }
      }
      // 💡 ログインしていない、またはデータがない場合は綺麗な /login 画面へジャンプ
      router.push("/login");
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="text-xs text-slate-400 font-bold animate-pulse">Sukiwork 起動中...</div>
    </div>
  );
}