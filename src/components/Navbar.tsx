"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="h-12 border-b border-slate-200 bg-white flex items-center px-6 justify-between shrink-0 select-none">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-sm font-black text-slate-900 tracking-tight">
            タスクミー
          </span>
          <span className="text-[9px] font-black bg-[#0082C8] text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
            TASK ME
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/logout" className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">
          ログアウト
        </Link>
      </div>
    </nav>
  );
}