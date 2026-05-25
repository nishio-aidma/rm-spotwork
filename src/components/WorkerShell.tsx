"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function WorkerShell({ children, title, subTitle }: { children: ReactNode; title: string; subTitle?: string }) {
  const pathname = usePathname();
  
  const nav = [
    { name: 'ダッシュボード', href: '/worker/dashboard', icon: '📊' },
    { name: '案件を探す', href: '/worker/jobs', icon: '🔍' },
    { name: '進行中のタスク', href: '/worker/my-jobs', icon: '⏳' }, // フォルダ名に修正
    { name: 'マイ・プロフィール', href: '/worker/profile', icon: '👤' },
    { name: '稼働履歴', href: '/worker/work-logs', icon: '📜' }, // フォルダ名に修正
  ];

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-64 bg-[#F8FAFC] border-r border-slate-100 flex flex-col flex-shrink-0">
        <div className="p-8">
          <h1 className="text-indigo-600 font-black italic text-sm tracking-tighter uppercase">Worker Portal</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {nav.map((item) => (
            <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold transition-all ${pathname === item.href ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}>
              <span className="text-base">{item.icon}</span>{item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-all">
            <span>🚪</span>ログアウト
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden text-slate-800">
        <header className="h-16 border-b border-slate-50 bg-white flex items-center px-8 justify-between flex-shrink-0">
          <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{subTitle}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-10">
          <div className="max-w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}