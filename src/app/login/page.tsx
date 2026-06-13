"use client";

import { useState, useEffect } from "react"; 
import { auth, db } from "@/lib/firebase";  
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"; 
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore"; 
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true); 
  const [loading, setLoading] = useState(false); 
  const router = useRouter();

  // 【自動ドア機能】すでにログインされているユーザーは自動でダッシュボードへジャンプ
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userRole = userDoc.data().role;
            router.push(`/${userRole}/dashboard`);
            return; 
          }
        } catch (err) {
          console.error("自動ログインエラー:", err);
        }
      }
      setCheckingAuth(false); 
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; 

    try {
      setLoading(true); 

      // ユーザー固有のアドレスをベースに、裏側で安全な共通合鍵（パスワード）を自動生成
      const secretPassword = `${email}_sukiwork_secure_2026`;

      try {
        // 🔥 パターン1：すでに認証アカウント（Auth）が作成されている既存メンバーの場合
        const userCred = await signInWithEmailAndPassword(auth, email, secretPassword);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        
        if (userDoc.exists()) {
          router.push(`/${userDoc.data().role}/dashboard`);
          return;
        } else {
          alert("ユーザーデータが見つかりません。オーナーにお問い合わせください。");
          return;
        }
      } catch (loginError: any) {
        // 🔥 パターン2：認証アカウント（Auth）にはまだない場合（ownerがFirestoreにメールを新規登録した直後の初回ログイン）
        if (loginError.code === "auth/user-not-found" || loginError.code === "auth/invalid-credential") {
          
          // Firestoreから、ownerが事前登録したメールアドレスがあるか検索
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // 事前登録データを発見！
            const existingDoc = querySnapshot.docs[0];
            const userData = existingDoc.data();

            // 初回ログインとして承認し、裏側でAuthアカウントを自動生成
            const userCred = await createUserWithEmailAndPassword(auth, email, secretPassword);
            
            // 💡【修正点】ownerが登録した「lastName」「firstName」のデータを、1文字も漏らさず新UIDデータへ完全同期保存
            await setDoc(doc(db, "users", userCred.user.uid), {
              email: email,
              role: userData.role || "worker", 
              lastName: userData.lastName || "", // 姓を引き継ぐ
              firstName: userData.firstName || "", // 名を引き継ぐ
              createdAt: userData.createdAt || new Date(),
              updatedAt: new Date()
            });

            // 重複防止のために古い事前登録用の一時データをクリーンアップ削除
            if (existingDoc.id !== userCred.user.uid) {
              await deleteDoc(existingDoc.ref);
            }

            // 指定されたダッシュボードへ直行
            router.push(`/${userData.role || "worker"}/dashboard`);
            return;
          } else {
            alert("このメールアドレスはシステムに登録されていません。オーナー（管理者）に登録を依頼してください。");
            return;
          }
        } else {
          alert("ログインエラー: " + loginError.message);
        }
      }

    } catch (error: any) {
      alert("エラー: " + error.message);
    } finally {
      setLoading(false); 
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-xs text-slate-400 font-bold animate-pulse">Sukiwork 起動中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans antialiased">
      <div className="max-w-sm w-full bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        
        <div className="text-center mb-4">
          <div className="w-9 h-9 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
            S
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Sukiwork ワークスペース
          </h1>
        </div>

        <div className="mb-4 bg-slate-50 border border-slate-100 rounded p-3 text-[11px] text-slate-600 space-y-1 leading-relaxed">
          <div className="font-bold text-slate-900 flex items-center gap-1">🔑 事前登録メンバー専用ログイン</div>
          <div>① オーナーから登録されたメールアドレスを入力します。</div>
          <div>② パスワードは不要です。アドレスが一致することで即座にシステムに承認されます。</div>
          <div className="text-indigo-600 font-semibold mt-1 pt-1 border-t border-slate-200/60">
            ※2回目以降は、アプリを開くだけで面倒な入力をすべてスキップし、自動的にダッシュボードへ直行します。
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">メールアドレス</label>
            <input 
              type="email" 
              placeholder="name@email.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:border-slate-500 bg-white text-slate-800" 
              required 
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white py-2.5 rounded text-xs font-bold transition-colors mt-4 block text-center ${
              loading ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {loading ? "サインイン中..." : "パスワードなしでログイン"}
          </button>
        </form>

      </div>
    </div>
  );
}