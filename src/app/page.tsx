"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role === "owner") {
      router.replace("/owner/dashboard");
    } else if (role === "worker") {
      router.replace("/worker/dashboard");
    }
  }, [user, role, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (role === "owner" || role === "worker") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-sm text-slate-500">ダッシュボードへ移動しています...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">ポータル</h1>
        <p className="mt-2 text-sm text-slate-500">
          役割が未設定です。Firestore の <code className="text-xs">users</code>{" "}
          ドキュメントに <code className="text-xs">role</code> を設定してください。
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/owner/dashboard"
            className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
          >
            管理者ダッシュボードへ
          </Link>
          <Link
            href="/worker/dashboard"
            className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
          >
            ワーカーダッシュボードへ
          </Link>
        </div>
      </div>
    </div>
  );
}
