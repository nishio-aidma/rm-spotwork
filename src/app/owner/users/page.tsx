"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerUsersPage() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkersWithLastActive() {
      if (!user) return;
      try {
        const q = query(collection(db, "users"), where("role", "==", "worker"));
        const snap = await getDocs(q);
        
        const workerList = await Promise.all(snap.docs.map(async (d) => {
          const userData = { id: d.id, ...d.data() };
          
          // 最終稼働日を取得（最新のログを1件だけ探す）
          const logQ = query(
            collection(db, "workLogs"),
            where("workerId", "==", d.id),
            orderBy("timestamp", "desc"),
            limit(1)
          );
          const logSnap = await getDocs(logQ);
          const lastLog = logSnap.docs[0]?.data();
          
          return {
            ...userData,
            lastActive: lastLog?.timestamp?.toDate() || null
          };
        }));

        setWorkers(workerList);
      } catch (error) {
        console.error("Error fetching workers:", error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchWorkersWithLastActive();
  }, [user, authLoading]);

  if (authLoading || loading) return <OwnerShell title="ワーカー管理"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></OwnerShell>;

  return (
    <OwnerShell title="ワーカー管理" subTitle="登録作業者の活動状況と管理">
      <div className="max-w-5xl mx-auto space-y-6 pb-20 text-slate-800 font-sans">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">作業者一覧 ({workers.length})</h2>
          <Link href="/owner/users/new" className="bg-slate-900 text-white px-5 py-2 rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-all shadow-sm">
            ＋ 新規ワーカー登録
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse table-auto">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">名前 / メールアドレス</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">登録日</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">最終稼働</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">{w.lastName} {w.firstName}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{w.email}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-[11px] text-slate-500 font-mono">
                    {w.createdAt?.toDate().toLocaleDateString() || "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {w.lastActive ? (
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono">
                        {w.lastActive.toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic text-[10px]">未稼働</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/owner/users/${w.id}`} className="text-slate-400 group-hover:text-slate-900 font-bold text-[10px] underline decoration-slate-200 underline-offset-4 transition-all">
                      詳細を確認 ≫
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workers.length === 0 && (
            <div className="p-20 text-center text-slate-300 text-sm italic">
              登録されているワーカーはいません。
            </div>
          )}
        </div>
      </div>
    </OwnerShell>
  );
}