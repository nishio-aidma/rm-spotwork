"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";

export default function WorkerSettingsPage() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setLastName(data.lastName || "");
        setFirstName(data.firstName || "");
      }
    }
    fetchProfile();
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus("loading");
    try {
      await updateDoc(doc(db, "users", user.uid), { lastName, firstName });
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) { alert("失敗"); setStatus("idle"); }
  };

  if (authLoading) return null;

  return (
    <WorkerShell title="Settings" subTitle="アカウント設定">
      <div className="max-w-md bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input label="姓" value={lastName} onChange={setLastName} />
            <Input label="名" value={firstName} onChange={setFirstName} />
          </div>
          <button type="submit" disabled={status === "loading"} className={`w-full py-3 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${status === "success" ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white"}`}>{status === "loading" ? "更新中..." : status === "success" ? "✅ プロフィールを保存しました" : "プロフィールを保存する"}</button>
        </form>
      </div>
    </WorkerShell>
  );
}
const Input = ({ label, value, onChange }: any) => (
  <div>
    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5">{label}</label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-md border border-slate-200 p-2.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-indigo-500" required />
  </div>
);