"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // ★新規追加：ログインの通信中かどうかを記録するローディングスイッチ
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // 画面が勝手にリロードされるのを防ぐおまじない
    setError("");
    setIsLoading(true); // ★ボタンが押された瞬間にローディングスイッチをONにする

    try {
      // Firebaseにメールとパスワードを投げて認証を要求
      await signInWithEmailAndPassword(auth, email, password);
      
      // ログインに成功したら、認証状態を感知したシステムが自動で画面を切り替えるため、
      // ここでは画面データを最新にするリフレッシュを呼び出します
      router.refresh();
    } catch (err: any) {
      console.error("ログインエラー:", err);
      // エラーが起きた場合は、初心者にもわかりやすい言葉に翻訳して画面に表示
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("メールアドレスまたはパスワードが間違っています。");
      } else {
        setError("サインインに失敗しました。通信環境を確認してください。");
      }
      setIsLoading(false); // ★エラーで戻ってきたら、もう一度入力できるようにスイッチをOFFにする
    }
  };

  return (
    <div className="w-full max-w-sm bg-white border-2 border-slate-300 rounded p-6 shadow-sm space-y-4 text-slate-900 font-sans antialiased">
      
      {/* タイトル：POSレジ・現場風のパキッとしたヘッダー */}
      <div className="text-center pb-2 select-none border-b-2 border-slate-100">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">業務管理システム</h2>
        <p className="text-[9px] text-slate-400 font-black mt-0.5 font-mono tracking-widest">ACCOUNT SIGN-IN</p>
      </div>

      {/* エラーメッセージ：警告が発生した時だけパキッと赤枠で出現 */}
      {error && (
        <div className="p-2.5 bg-rose-50 border-2 border-rose-200 rounded text-rose-700 text-xs font-bold leading-tight select-none">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        
        {/* メールアドレス入力欄 */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">メールアドレス</label>
          <input
            type="email"
            required
            disabled={isLoading} // ★通信中は入力欄をグレーアウトして触れなくする
            className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] transition-colors disabled:bg-slate-100 disabled:text-slate-400 font-mono"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* パスワード入力欄 */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">パスワード</label>
          <input
            type="password"
            required
            disabled={isLoading} // ★通信中は入力欄をグレーアウトして触れなくする
            className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] transition-colors disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* サインイン実行ボタン：お会計スタイル */}
        <button
          type="submit"
          disabled={isLoading} // ★通信中はボタンを押せなくする
          className="w-full py-2.5 bg-[#0082C8] hover:bg-[#0072B5] text-white rounded text-xs font-black border border-black/10 transition-colors shadow-sm disabled:opacity-50 mt-2 select-none"
        >
          {/* スイッチの状態に合わせて文字をパキッと切り替える */}
          {isLoading ? "サインイン中..." : "サインイン 🔑"}
        </button>
        
      </form>
    </div>
  );
}