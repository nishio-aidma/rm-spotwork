"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState("ログイン処理を行っています...");

  useEffect(() => {
    const confirmSignIn = async () => {
      try {
        // 1. 今開いているURLが有効なメールリンクかチェック
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setStatus("無効なリンク、または期限切れのリンクです。もう一度最初からお試しください。");
          return;
        }

        // 2. ログイン画面でブラウザに一時保存しておいたメールアドレスを取得
        let email = window.localStorage.getItem("emailForSignIn");

        // 💡【スマホ対策】万が一、別ブラウザなどで開いてメールアドレスの記憶が消えていた場合は再入力してもらう
        if (!email) {
          email = window.prompt("確認のため、もう一度メールアドレスを入力してください：");
        }

        if (!email) {
          setStatus("メールアドレスが確認できないため、ログインを中断しました。");
          return;
        }

        setStatus("認証を完了しています。まもなくダッシュボードへ移動します...");

        // 3. 魔法のリンクを使ってFirebaseにサインイン（新規アカウントならこの時点で自動作成されます）
        const result = await signInWithEmailLink(auth, email, window.location.href);

        // 4. 用が済んだブラウザの一時記憶データをきれいに消去
        window.localStorage.removeItem("emailForSignIn");
        const storedName = window.localStorage.getItem("nameForSignIn");
        window.localStorage.removeItem("nameForSignIn");

        // 5. Firestoreのユーザー情報をチェックして、新人と既存メンバーで処理を分ける
        const uid = result.user.uid;
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // 既存ユーザーの場合：登録されているrole（workerやowner）のダッシュボードへ自動リダイレクト
          const userData = userDoc.data();
          setStatus(`ログイン成功！ ${userData.name || "ユーザー"} さん、移動します...`);
          router.push(`/${userData.role}/dashboard`);
        } else {
          // 新規ユーザーの場合：Firestoreに名前などを初期登録する
          setStatus("アカウントを作成中...");
          const finalName = storedName || "新規ワーカー";
          
          await setDoc(userDocRef, {
            name: finalName,
            email: email,
            role: "worker", // デフォルトはワーカー
            createdAt: new Date(),
          });

          setStatus(`${finalName} さんの登録が完了しました！移動します...`);
          router.push("/worker/dashboard");
        }

      } catch (error: any) {
        console.error("Authentication Error:", error);
        setStatus("エラーが発生しました: " + error.message);
      }
    };

    confirmSignIn();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl p-10 border border-slate-200 text-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-black animate-bounce shadow-lg shadow-indigo-100">
          🔑
        </div>
        <h1 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em] mb-4">
          Sukiwork 認証システム
        </h1>
        <p className="text-xs text-slate-600 font-medium bg-slate-50 border border-slate-100 rounded-lg py-3 px-4 leading-relaxed">
          {status}
        </p>
      </div>
    </div>
  );
}