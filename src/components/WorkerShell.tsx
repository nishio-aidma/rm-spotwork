"use client";

import { ReactNode, useState } from "react"; // 状態管理用の useState を追加
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function WorkerShell({ children, title, subTitle }: { children: ReactNode; title: string; subTitle?: string }) {
  const pathname = usePathname();
  // サインアウト中のロック用スイッチ
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // 表記を「案件探す」から「案件を探す」へ完全修正
  const nav = [
    { name: 'ダッシュ', href: '/worker/dashboard', icon: '📊' },
    { name: '案件を探す', href: '/worker/jobs', icon: '🔍' },
    { name: '進行中', href: '/worker/my-jobs', icon: '⏳' },
    { name: 'プロフ', href: '/worker/profile', icon: '👤' },
    { name: '履歴', href: '/worker/work-logs', icon: '📜' },
  ];

  const handleSignOut = async () => {
    setIsLoggingOut(true); // スイッチをONにする
    try {
      await signOut(auth);
    } catch (error) {
      console.error("サインアウトに失敗しました:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased text-slate-900 select-none">
      
      {/* 1. 上部ヘッダー：システム名「すきわーく」のロゴ風デザインをドッキング */}
      <header className="h-14 bg-[#0082C8] flex items-center px-4 justify-between text-white shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* 💡【新設】ちょいっと隙間におしごと すきわーく ロゴインフラ */}
          <div className="flex flex-col justify-center border-r border-white/20 pr-4 select-none">
            <span className="text-[8px] font-medium tracking-widest text-white/80 leading-none mb-0.5">ちょいっと隙間におしごと</span>
            <span className="text-sm font-black tracking-tight leading-none text-white drop-shadow-sm">すきわーく</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/20 px-2.5 py-1 rounded font-black text-xs tracking-wider">WORKER</div>
            <h1 className="text-sm font-bold tracking-tight">{title} <span className="text-white/60 font-normal text-xs">{subTitle}</span></h1>
          </div>
        </div>
        
        {/* スイッチ（isLoggingOut）の状態に合わせて表示とロックを切り替え */}
        <button 
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="bg-black/20 hover:bg-black/30 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-colors"
        >
          {isLoggingOut ? "サインアウト中..." : "サインアウト 🚪"}
        </button>
      </header>

      {/* 2. 下部メインエリア */}
      <div className="flex-1 flex min-h-0">
        
        {/* 左サイドナビ：幅を詰め、押しやすい縦並びの「メニュータイル」へ変更 */}
        <aside className="w-20 bg-[#E8EAEF] border-r border-slate-300 flex flex-col flex-shrink-0">
          <nav className="flex-1 p-1 space-y-1">
            {nav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center aspect-square w-full rounded border transition-all ${
                    isActive 
                      ? 'bg-white border-slate-400 text-[#0082C8] shadow-sm font-black' // 選択時は白の凹凸感のあるタイルに
                      : 'border-transparent text-slate-600 hover:bg-white/50 hover:text-slate-900'
                  }`}
                >
                  <span className="text-xl mb-1">{item.icon}</span>
                  <span className="text-[10px] tracking-tighter font-bold">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* メイン画面エリア：余白を詰めて高密度化 */}
        <main className="flex-1 overflow-y-auto p-4 min-w-0">
          <div className="max-w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}