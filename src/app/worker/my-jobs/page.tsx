"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";
import { useRouter } from "next/navigation";

export default function WorkerMyJobsPage() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchMyJobs() {
      if (!user) return;
      try {
        const q = query(
          collection(db, "jobs"),
          where("workerId", "==", user.uid),
          where("status", "in", ["working", "paused", "review"])
        );
        const snap = await getDocs(q);
        setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    if (!authLoading) fetchMyJobs();
  }, [user, authLoading]);

  if (authLoading || loading) return <WorkerShell title="Active Tasks"><div className="p-10 italic">Loading...</div></WorkerShell>;

  return (
    <WorkerShell title="Active Tasks" subTitle="進行中のタスク">
      <div className="space-y-6 pb-20">
        {/* 戻るボタン */}
        <button onClick={() => router.push("/worker/dashboard")} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-all">
          ← DASHBOARD
        </button>

        <div className="space-y-3">
          {jobs.length > 0 ? jobs.map((job) => (
            <Link key={job.id} href={`/worker/jobs/${job.id}`} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-4">
                <StatusBadge status={job.status} />
                <h3 className="text-xs font-bold text-slate-800">{job.title}</h3>
              </div>
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Detail & Report →</div>
            </Link>
          )) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
              <p className="text-xs text-slate-400 italic">現在、進行中のタスクはありません</p>
            </div>
          )}
        </div>
      </div>
    </WorkerShell>
  );
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: any = {
    working: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    paused: "bg-amber-50 text-amber-600 ring-amber-100",
    review: "bg-blue-50 text-blue-600 ring-blue-100",
  };
  const label: any = { working: "作業中", paused: "一時停止", review: "検収待ち" };
  return <span className={`px-2 py-0.5 rounded text-[8px] font-black ring-1 ring-inset ${map[status]}`}>{label[status]}</span>;
};