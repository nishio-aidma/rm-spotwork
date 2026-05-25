"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function OwnerShell({ children, title, subTitle }: { children: React.ReactNode, title: string, subTitle?: string }) {
  const pathname = usePathname();
  const [userName, setUserName] = useState("Owner");

  useEffect(() => {
    const fetchName = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const fullName = `${data.lastName || ""} ${data.firstName || ""}`.trim();
          setUserName(fullName || user.email?.split("@")[0] || "Owner");
        }
      }
    };
    fetchName();
  }, [pathname]);

  // menuItems 配列を以下のように更新してください
const menuItems = [
    { name: "ダッシュボード", href: "/owner/dashboard", icon: "📊" },
    { name: "案件管理", href: "/owner/jobs", icon: "📁" },
    { name: "ワーカー管理", href: "/owner/users", icon: "👥" },
    { name: "データ出力", href: "/owner/export", icon: "📥" }, // 追加
    { name: "システム設定", href: "/owner/settings", icon: "⚙️" },
    { name: "ランク設定", href: "/owner/settings/ranks", icon: "🏆" },
  ];

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30">
          <span className="text-[11px] font-black tracking-[0.1em] uppercase text-indigo-700 italic">Owner Management</span>
        </div>
        
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            // ★【ここが重要】
            const isActive = pathname === item.href || (item.href !== '/owner/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-bold transition-all relative ${
                  isActive 
                    ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {isActive && <div className="absolute left-0 w-1 h-4 bg-indigo-600 rounded-r-full" />}
                <span className="text-sm">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-black shadow-sm mx-auto">
              {userName.charAt(0)}
            </div>
            <span className="text-[10px] font-bold text-slate-600 truncate">{userName}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-slate-400">Admin</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800">{title}</span>
          </div>
          <Link href="/logout" className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-tighter border border-slate-200 rounded px-2 py-0.5 transition-colors">Sign Out</Link>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          <div className="max-w-full mx-auto">
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