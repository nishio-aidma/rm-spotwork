"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import OwnerShell from "@/components/OwnerShell";
import { useRouter } from "next/navigation";

export default function OwnerCreateUserPage() {
  const [role, setRole] = useState<"worker" | "owner">("worker");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("新しいユーザーを作成し、自動的にログアウトします。よろしいですか？")) return;
    setIsSubmitting(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCred.user.uid), { lastName, firstName, email, role, createdAt: new Date() });
      alert(`アカウント「${lastName} ${firstName}」を作成しました。`);
      await signOut(auth);
      router.push("/login");
    } catch (error: any) { alert("エラー: " + error.message); } finally { setIsSubmitting(false); }
  };

  return (
    <OwnerShell title="User Management" subTitle="ユーザー発行">
      <div className="max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button type="button" onClick={() => setRole("worker")} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md ${role === "worker" ? "bg-white text-indigo-600" : "text-slate-500"}`}>ワーカー</button>
            <button type="button" onClick={() => setRole("owner")} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md ${role === "owner" ? "bg-white text-indigo-600" : "text-slate-500"}`}>オーナー</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="姓" value={lastName} onChange={setLastName} />
            <Input label="名" value={firstName} onChange={setFirstName} />
          </div>
          <Input label="Email" value={email} onChange={setEmail} />
          <Input label="Password" value={password} onChange={setPassword} type="password" />
          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3 rounded-lg text-xs font-bold shadow-md">{isSubmitting ? "作成中..." : "ユーザーを新規発行する"}</button>
        </form>
      </div>
    </OwnerShell>
  );
}
const Input = ({ label, value, onChange, type = "text" }: any) => (
  <div>
    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-md border border-slate-200 p-2.5 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50" required />
  </div>
);