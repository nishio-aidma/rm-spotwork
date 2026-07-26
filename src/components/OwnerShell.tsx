"use client";

import { ReactNode, useState } from "react";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigation = [
    { name: 'ダッシュ', href: '/owner/dashboard', icon: '📊' },
    { name: '案件管理', href: '/owner/jobs', icon: '📁' },
    { name: 'ワーカー', href: '/owner/users', icon: '👥' }, 
    { name: 'データ出力', href: '/owner/export', icon: '📥' },
    { name: '稼働管理', href: '/owner/work-management', icon: '🛠️' },
    { name: 'システム設定', href: '/owner/settings', icon: '⚙️' },
  ];

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("サインアウトに失敗しました:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased text-slate-900 select-none">
      
      {/* 上部ヘッダー：背景はセージグリーン（#5CA685） */}
      <header className="h-14 bg-[#5CA685] flex items-center px-4 justify-between text-white shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          
          {/* ロゴテキストボックス（画像と絵文字を削除してスッキリ配置） */}
          <div className="bg-gradient-to-br from-white/18 to-white/4 px-3 py-1.5 rounded-md border border-white/25 flex items-center justify-center select-none shadow-inner backdrop-blur-xs">
            <span className="text-sm font-black tracking-wide leading-none text-white drop-shadow-md">
              タスクミー
            </span>
          </div>

          <div className="flex items-center gap-3 border-l border-white/20 pl-4 h-8">
            <div className="bg-white/20 px-2.5 py-1 rounded font-black text-xs tracking-wider">OWNER</div>
            <h1 className="text-sm font-bold tracking-tight">{title} <span className="text-white/60 font-normal text-xs">{subTitle}</span></h1>
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="bg-black/20 hover:bg-black/30 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
        >
          {isLoggingOut ? "サインアウト中..." : "サインアウト 🚪"}
        </button>
      </header>

      {/* 下部メインエリア */}
      <div className="flex-1 flex min-h-0">
        <aside className="w-20 bg-[#E8EAEF] border-r border-slate-300 flex flex-col flex-shrink-0">
          <nav className="flex-1 p-1 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center aspect-square w-full rounded border transition-all ${
                    isActive 
                      ? 'bg-white border-slate-400 text-[#5CA685] shadow-sm font-black'
                      : 'border-transparent text-slate-600 hover:bg-white/50 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xl mb-1">{item.icon}</span>
                  <span className="text-[10px] tracking-tighter font-bold">{item.name}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}