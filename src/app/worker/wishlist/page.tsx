"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";

export default function WorkerWishlistPage() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWishlist() {
      if (!user) return;
      try {
        const q = query(collection(db, "jobs"), where("wishedBy", "array-contains", user.uid));
        const snap = await getDocs(q);
        setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (!authLoading) fetchWishlist();
  }, [user, authLoading]);

  if (authLoading || loading) return <WorkerShell title="Wishlist"><div className="text-[10px] text-slate-400 font-mono italic">Loading resources...</div></WorkerShell>;

  return (
    <WorkerShell title="Wishlist" subTitle="保存済みの案件">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.length > 0 ? jobs.map((job) => (
          <Link key={job.id} href={`/worker/jobs/${job.id}`} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md relative overflow-hidden flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[8px] font-black uppercase text-slate-500 ring-1 ring-inset ring-slate-200">
                  {job.status}
                </span>
                <span className="text-rose-500 text-[10px] font-bold">❤️ {job.wishCount || 0}</span>
              </div>
              <h3 className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-2">{job.title}</h3>
            </div>
            
            <div className="flex justify-between items-end border-t border-slate-50 pt-3 mt-4">
              <div className="text-[11px] font-mono font-bold text-slate-600">¥{job.reward?.toLocaleString()}</div>
              <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-tighter">Open →</span>
            </div>
          </Link>
        )) : (
          <div className="col-span-full py-20 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
            <p className="text-xs text-slate-400 italic">保存された案件はありません</p>
          </div>
        )}
      </div>
    </WorkerShell>
  );
}