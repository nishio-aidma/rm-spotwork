"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface OwnerShellProps {
  children: ReactNode;
  title: string;
  subTitle?: string;
}

export default function OwnerShell({ children, title, subTitle }: OwnerShellProps) {
  const pathname = usePathname();

  // src/components/OwnerShell.tsx

  const navigation = [
    { name: 'ダッシュボード', href: '/owner/dashboard', icon: '📊' },
    { name: '案件管理', href: '/owner/jobs', icon: '📁' },
    { name: 'ワーカー管理', href: '/owner/users', icon: '👥' }, 
    { name: 'データ出力', href: '/owner/export', icon: '📥' },
    { name: 'システム設定', href: '/owner/settings', icon: '⚙️' },
    { name: 'ランク設定', href: '/owner/settings/ranks', icon: '🏆' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* サイドメニュー */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col flex-shrink-0">
        <div className="p-8">
          <h1 className="text-slate-900 font-bold italic text-sm tracking-tighter">
            OWNER <span className="text-slate-400 font-medium">MANAGEMENT</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[11px] font-bold transition-all ${
                  isActive 
                    ? 'bg-slate-100 text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full px-4 py-3 text-[11px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
          >
            <span className="text-base">🚪</span>
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-slate-200 bg-white flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-slate-400">ADMIN</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800">{title}</span>
          </div>
          {/* ✅ SIGN OUT を ログアウト に修正 */}
          <button 
            onClick={() => signOut(auth)}
            className="text-[9px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-tight transition-all"
          >
            ログアウト
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-full mx-auto">
            {subTitle && (
              <div className="mb-6">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight">{subTitle}</h2>
                <div className="h-0.5 w-6 bg-slate-900 mt-1 rounded-full"></div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}