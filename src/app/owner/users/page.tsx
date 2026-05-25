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

  if (authLoading || loading) return <OwnerShell title="Users"><div className="p-10 italic text-slate-400 text-center">Loading...</div></OwnerShell>;

  return (
    <OwnerShell title="Worker Management" subTitle="ワーカーの活動状況">
      <div className="max-w-5xl mx-auto space-y-6 pb-20 font-sans text-slate-900">
        
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Worker List</h2>
          <Link href="/owner/users/new" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[11px] font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <span>＋</span> 新規ワーカー登録
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">ワーカー名</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">登録日</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">最終稼働日</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px]">
              {workers.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{w.lastName} {w.firstName}</div>
                    <div className="text-[9px] text-slate-300 font-mono">{w.email}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-500 font-mono">
                    {w.createdAt?.toDate().toLocaleDateString() || "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {w.lastActive ? (
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold font-mono">
                        {w.lastActive.toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic">未稼働</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/owner/users/${w.id}`} className="text-indigo-600 hover:underline font-black text-[10px]">
                      詳細 ≫
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerShell>
  );
}