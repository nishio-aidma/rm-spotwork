"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="h-12 border-b border-slate-200 bg-white flex items-center px-6 justify-between shrink-0">
      <div className="flex items-center gap-8">
        <span className="text-xs font-black text-slate-900 tracking-tighter">業務管理システム</span>
        {/* ← ここにあった「ダッシュボード」「案件を作成する」のLinkを削除しました */}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/logout" className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">
          ログアウト
        </Link>
      </div>
    </nav>
  );
}