"use client";

import { ReactNode, useState } from "react"; // 状態を覚えるための useState を追加
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
  // サインアウト中かどうかを記録するスイッチ（初期値は false）
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigation = [
    { name: 'ダッシュ', href: '/owner/dashboard', icon: '📊' },
    { name: '案件管理', href: '/owner/jobs', icon: '📁' },
    { name: 'ワーカー', href: '/owner/users', icon: '👥' }, 
    { name: 'データ出力', href: '/owner/export', icon: '📥' },
    { name: 'システム設定', href: '/owner/settings', icon: '⚙️' },
  ];

  // サインアウトボタンが押された時の処理
  const handleSignOut = async () => {
    setIsLoggingOut(true); // スイッチをONにする（ボタンを「中...」に変えてロック）
    try {
      await signOut(auth);
    } catch (error) {
      console.error("サインアウトに失敗しました:", error);
      setIsLoggingOut(false); // エラーが起きたらボタンを元に戻す
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased text-slate-900 select-none">
      
      {/* 1. 上部ヘッダー：イメージ画像のような鮮やかなブルー（#0082C8）を採用 */}
      <header className="h-14 bg-[#0082C8] flex items-center px-4 justify-between text-white shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 px-2.5 py-1 rounded font-black text-xs tracking-wider">OWNER</div>
          <h1 className="text-sm font-bold tracking-tight">{title} <span className="text-white/60 font-normal text-xs">{subTitle}</span></h1>
        </div>
        
        {/* ボタンの状態をスイッチ（isLoggingOut）と連動させる */}
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
        
        {/* 左サイドナビ：幅をキュッと縮め、画像のような縦並びの「メニュータイル」へ */}
        <aside className="w-20 bg-[#E8EAEF] border-r border-slate-300 flex flex-col flex-shrink-0">
          <nav className="flex-1 p-1 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center aspect-square w-full rounded border transition-all ${
                    isActive 
                      ? 'bg-white border-slate-400 text-[#0082C8] shadow-sm font-black' // 選択時は白のタイルに
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

        {/* メイン画面エリア */}
        <main className="flex-1 overflow-y-auto p-4 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}