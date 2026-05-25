"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function WorkerShell({ children, title, subTitle }: { children: React.ReactNode, title: string, subTitle?: string }) {
  const pathname = usePathname();
  const [userName, setUserName] = useState("Worker");

  useEffect(() => {
    // 認証状態を監視して名前を取得
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const fullName = `${data.lastName || ""} ${data.firstName || ""}`.trim();
          setUserName(fullName || "Worker");
        }
      }
    });
    return () => unsub();
  }, []);

  // menuItems の配列に profile を追加
const menuItems = [
  { name: "ダッシュボード", href: "/worker/dashboard", icon: "📊" },
  { name: "案件を探す", href: "/worker/jobs", icon: "🔍" },
  { name: "進行中のタスク", href: "/worker/my-jobs", icon: "⏳" },
  { name: "マイ・プロフィール", href: "/worker/profile", icon: "👤" }, // ★ これを追加
  { name: "稼働履歴", href: "/worker/work-logs", icon: "📜" },
];

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <span className="text-[11px] font-black tracking-[0.1em] uppercase text-indigo-600">Worker Console</span>
        </div>
        
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = item.href === '/worker/jobs'
              ? pathname === '/worker/jobs'
              : pathname.startsWith(item.href) || (item.href === '/worker/my-jobs' && pathname.startsWith('/worker/jobs/'));
            
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-bold transition-all relative ${isActive ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}>
                {isActive && <div className="absolute left-0 w-1 h-4 bg-indigo-600 rounded-r-full" />}
                <span className="text-sm">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-black shadow-sm flex-shrink-0">
              {userName.charAt(0)}
            </div>
            <span className="text-[10px] font-bold text-slate-600 truncate">{userName}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-slate-400">Worker</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800">{title}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* ウィッシュリスト ❤️ アイコン */}
            <Link href="/worker/wishlist" className="p-2 text-slate-400 hover:text-rose-500 transition-all transform hover:scale-110" title="ウィッシュリスト">
              <span className="text-base leading-none">❤️</span>
            </Link>
            <Link href="/logout" className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-tighter border border-slate-200 rounded px-2 py-0.5 transition-colors">Sign Out</Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          <div className="max-w-6xl mx-auto">
            {subTitle && (
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 tracking-tight">{subTitle}</h2>
                <div className="h-0.5 w-8 bg-indigo-500 mt-1 rounded-full"></div>
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}