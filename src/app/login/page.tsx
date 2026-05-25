"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState(""); // 名前用のステートを追加
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        if (userDoc.exists()) {
          router.push(`/${userDoc.data().role}/dashboard`);
        }
      } else {
        // 新規登録：名前がない場合はエラー
        if (!name.trim()) {
          alert("お名前を入力してください");
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
          name: name, // 名前を保存
          email: email,
          role: "worker",
          createdAt: new Date(),
        });
        router.push("/worker/dashboard");
      }
    } catch (error: any) {
      alert("エラー: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl p-10 border border-slate-200">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100">W</div>
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">
            {isLogin ? "Worker Login" : "Join as Worker"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="animate-in fade-in duration-500">
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">お名前</label>
              <input type="text" placeholder="例：山田 太郎" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border border-slate-200 p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50" required />
            </div>
          )}
          
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">メールアドレス</label>
            <input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-md border border-slate-200 p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50" required />
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">パスワード</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-md border border-slate-200 p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50" required />
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg text-xs font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95 mt-2">
            {isLogin ? "ログインする" : "ワーカーとして登録する"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <button onClick={() => setIsLogin(!isLogin)} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors">
            {isLogin ? "新しくワーカー登録する" : "すでにアカウントをお持ちの方"}
          </button>
        </div>
      </div>
    </div>
  );
}