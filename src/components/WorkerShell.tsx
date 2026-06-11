"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function WorkerShell({ children, title, subTitle }: { children: ReactNode; title: string; subTitle?: string }) {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const nav = [
    { name: 'ダッシュ', href: '/worker/dashboard', icon: '📊' },
    { name: '案件を探す', href: '/worker/jobs', icon: '🔍' },
    { name: '進行中', href: '/worker/my-jobs', icon: '⏳' },
    { name: 'プロフ', href: '/worker/profile', icon: '👤' },
    { name: '履歴', href: '/worker/work-logs', icon: '📜' },
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
      
      {/* 上部ヘッダー */}
      <header className="h-14 bg-[#0082C8] flex items-center px-4 justify-between text-white shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          
          {/* 💡【プロ仕様ロゴリフォーム】高級感のあるエンブレム座布団とシンボルマークのドッキング */}
          {/* ※将来的にデザイン画像(SVG/PNG)をそのまま埋め込む場合は、このdivの中身を <img src="/logo.svg" className="h-8 w-auto" /> 等に1行で差し替え可能です */}
          <div className="bg-gradient-to-br from-white/18 to-white/4 px-3 py-1 rounded-md border border-white/25 flex items-center gap-2 select-none shadow-inner backdrop-blur-xs">
            <span className="text-xl filter drop-shadow-sm leading-none animate-pulse">⏱️</span>
            <div className="flex flex-col justify-center">
              <span className="text-[8px] font-black tracking-widest text-white/90 leading-none mb-0.5 uppercase">ちょいっと隙間におしごと</span>
              <span className="text-sm font-black tracking-wide leading-none text-white bg-clip-text bg-gradient-to-r from-white to-slate-100 drop-shadow-md">
                すきわ～く<span className="text-[10px] text-white/80 font-bold ml-0.5">✨</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-white/20 pl-4 h-8">
            <div className="bg-white/20 px-2.5 py-1 rounded font-black text-xs tracking-wider">WORKER</div>
            <h1 className="text-sm font-bold tracking-tight">{title} <span className="text-white/60 font-normal text-xs">{subTitle}</span></h1>
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="bg-black/20 hover:bg-black/30 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-colors"
        >
          {isLoggingOut ? "サインアウト中..." : "サインアウト 🚪"}
        </button>
      </header>

      {/* 下部メインエリア */}
      <div className="flex-1 flex min-h-0">
        <aside className="w-20 bg-[#E8EAEF] border-r border-slate-300 flex flex-col flex-shrink-0">
          <nav className="flex-1 p-1 space-y-1">
            {nav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center aspect-square w-full rounded border transition-all ${
                    isActive 
                      ? 'bg-white border-slate-400 text-[#0082C8] shadow-sm font-black'
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
          <div className="max-w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}