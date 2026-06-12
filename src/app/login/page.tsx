"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { sendSignInLinkToEmail } from "firebase/auth";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState(""); 
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false); // メール送信が成功したかどうかの状態

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!isLogin && !name.trim()) {
        alert("お名前を入力してください");
        return;
      }

      // 💡 リンクをクリックした時の戻り先URL（ローカル環境でも本番Vercelでも自動で対応します）
      const origin = window.location.origin;
      const actionCodeSettings = {
        url: `${origin}/login/verify`,
        handleCodeInApp: true,
      };

      // 🚀 Firebaseにメールリンクの送信を要求
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);

      // 🔑 リンクを踏んで戻ってきた時に使うため、入力された情報をブラウザに一時保存
      window.localStorage.setItem("emailForSignIn", email);
      if (!isLogin) {
        window.localStorage.setItem("nameForSignIn", name); // 新規登録なら名前も保存
      } else {
        window.localStorage.removeItem("nameForSignIn");
      }

      setIsSent(true); // 送信完了画面に切り替え
    } catch (error: any) {
      alert("メール送信エラー: " + error.message);
    }
  };

  // ✉️ メール送信が完了した後の「確認してね画面」
  if (isSent) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl p-10 border border-slate-200 text-center">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-100">✓</div>
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em] mb-2">
            確認メールを送信しました！
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            <span className="font-bold text-slate-700 block my-1">{email}</span>
            宛てにログイン用の魔法のリンクを送信しました。メール内のリンクをクリックしてログインを完了してください。
          </p>
          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-4">
            ※メールが届かない場合は、迷惑メールフォルダをご確認いただくか、もう一度お試しください。
          </div>
        </div>
      </div>
    );
  }

  // 📝 通常の入力画面（パスワード欄は綺麗に消去済み）
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

          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg text-xs font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95 mt-4">
            {isLogin ? "ログインメールを受け取る" : "登録用メールを受け取る"}
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