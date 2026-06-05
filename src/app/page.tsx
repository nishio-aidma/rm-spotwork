"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<"worker" | "owner">("worker"); // ★ 権限用のステートを追加
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        // ログイン時はFirebaseのデータに登録されているroleを読み込んで自動振り分け
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        if (userDoc.exists()) {
          router.push(`/${userDoc.data().role}/dashboard`);
        } else {
          alert("ユーザーデータが見つかりません");
        }
      } else {
        // 新規登録時
        if (!name.trim()) {
          alert("お名前を入力してください");
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
          name: name,
          email: email,
          role: role, // ★ 選択された権限（worker または owner）を保存
          createdAt: new Date(),
        });
        router.push(`/${role}/dashboard`);
      }
    } catch (error: any) {
      alert("エラー: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans antialiased">
      <div className="max-w-sm w-full bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        
        <div className="text-center mb-6">
          <div className="w-9 h-9 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
            {role === "owner" ? "O" : "W"}
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            {isLogin ? "ワークスペースにログイン" : "新しくアカウントを作成"}
          </h1>
        </div>

        {/* ★ アカウント種別の切り替えタブ（新規登録モードの時だけ表示されるSlack風フラットトグル） */}
        {!isLogin && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded mb-4">
            <button
              type="button"
              onClick={() => setRole("worker")}
              className={`py-1.5 text-[11px] font-bold rounded transition-colors ${
                role === "worker" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              ワーカーとして登録
            </button>
            <button
              type="button"
              onClick={() => setRole("owner")}
              className={`py-1.5 text-[11px] font-bold rounded transition-colors ${
                role === "owner" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              オーナーとして登録
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">お名前</label>
              <input 
                type="text" 
                placeholder="例：山田 太郎" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:border-slate-500 bg-white text-slate-800" 
                required 
              />
            </div>
          )}
          
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">メールアドレス</label>
            <input 
              type="email" 
              placeholder="name@email.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:border-slate-500 bg-white text-slate-800" 
              required 
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">パスワード</label>
            <input 
              type="password" 
              placeholder="パスワードを入力" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:border-slate-500 bg-white text-slate-800" 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-slate-900 text-white py-2.5 rounded text-xs font-bold hover:bg-slate-800 transition-colors mt-2 block text-center"
          >
            {isLogin ? "ログイン" : `${role === "owner" ? "オーナー" : "ワーカー"}として作成`}
          </button>
        </form>

        <div className="mt-5 text-center pt-2">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors"
          >
            {isLogin ? "新しくアカウントを作成する" : "登録済みのアカウントでログインする"}
          </button>
        </div>
      </div>
    </div>
  );
}