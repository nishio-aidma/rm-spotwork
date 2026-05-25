"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Search, 
  FileText, 
  Settings,
  LogOut,
  Bell
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface WorkerShellProps {
  children: ReactNode;
  title: string;
  subTitle?: string;
}

export default function WorkerShell({ children, title, subTitle }: WorkerShellProps) {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/worker/dashboard', icon: LayoutDashboard },
    { name: '案件を探す', href: '/worker/jobs', icon: Search },
    { name: '作業中・履歴', href: '/worker/tasks', icon: FileText },
    { name: '設定', href: '/worker/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col">
        <div className="p-8">
          <h1 className="text-xl font-black text-indigo-600 tracking-tighter">
            WORKER<span className="text-slate-400">PORTAL</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <div className="h-full px-8 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{subTitle || 'Worker Account'}</p>
              <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            </div>
            <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className="p-8">
          {/* ここを max-w-full に変更しました */}
          <div className="max-w-full mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}