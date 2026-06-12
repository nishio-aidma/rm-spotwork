"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("ログイン処理を行っています...");
  const [requireInput, setRequireInput] = useState(false); // メールアドレスの再入力フォームを表示するか
  const [inputEmail, setInputEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const hasRun = useRef(false); // 2回連続で処理が走るのを防ぐ防壁

  // 🔐 実際のログイン・登録処理を行う中心関数
  const handleAuth = async (emailAddress: string) => {
    try {
      setLoading(true);
      setStatus("認証を完了しています。まもなくダッシュボードへ移動します...");

      // 魔法のリンクを使ってFirebaseにサインイン
      const result = await signInWithEmailLink(auth, emailAddress, window.location.href);

      // 用が済んだブラウザの一時記憶データを消去
      window.localStorage.removeItem("emailForSignIn");
      const storedName = window.localStorage.getItem("nameForSignIn");
      window.localStorage.removeItem("nameForSignIn");

      const uid = result.user.uid;
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // 既存ユーザー：それぞれの役割のダッシュボードへリダイレクト
        const userData = userDoc.data();
        setStatus(`ログイン成功！ ${userData.name || "ユーザー"} さん、移動します...`);
        router.push(`/${userData.role}/dashboard`);
      } else {
        // 新規ユーザー：Firestoreに初期登録
        setStatus("アカウントを作成中...");
        const finalName = storedName || "新規ワーカー";
        
        await setDoc(userDocRef, {
          name: finalName,
          email: emailAddress,
          role: "worker",
          createdAt: new Date(),
        });

        setStatus(`${finalName} さんの登録が完了しました！移動します...`);
        router.push("/worker/dashboard");
      }
    } catch (error: any) {
      console.error("Authentication Error:", error);
      setStatus("エラーが発生しました: " + error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus("無効なリンク、または期限切れのリンクです。もう一度最初からお試しください。");
      return;
    }

    // ログインボタンを押したブラウザの記憶を取得
    const email = window.localStorage.getItem("emailForSignIn");

    if (!email) {
      // 💡【ここが進化！】記憶が消えている場合は、ブロックされるポップアップではなく画面内に直接入力フォームをONにする
      setRequireInput(true);
      setStatus("安全のため、もう一度メールアドレスを入力してください。");
    } else {
      // 記憶が残っていればそのまま全自動でログイン
      handleAuth(email);
    }
  }, [router]);

  // 手動でメールアドレスを入力してボタンを押したときの処理
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    setRequireInput(false);
    handleAuth(inputEmail.trim());
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl p-10 border border-slate-200 text-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100">
          🔑
        </div>
        <h1 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em] mb-4">
          Sukiwork 認証システム
        </h1>
        
        <p className="text-xs text-slate-600 font-medium bg-slate-50 border border-slate-100 rounded-lg py-3 px-4 leading-relaxed mb-4">
          {status}
        </p>

        {/* 💡 スマホのメールアプリ内ブラウザで開いた時だけ出現する安心の入力フォーム */}
        {requireInput && (
          <form onSubmit={handleFormSubmit} className="space-y-3 text-left animate-in fade-in duration-300">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                確認用メールアドレス
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                className="w-full rounded-md border border-slate-200 p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95"
            >
              認証を完了してログインする
            </button>
          </form>
        )}
      </div>
    </div>
  );
}