"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";

// ★ 共有いただいたfirebaseConfigをそのまま流用し、裏口生成用のパーツにします
const firebaseConfig = {
  apiKey: "AIzaSyBRR1L-yHfKrZcMxwtMWqr7h3hcDE5iX7Q",
  authDomain: "my-gyomu-app.firebaseapp.com",
  projectId: "my-gyomu-app",
  storageBucket: "my-gyomu-app.firebasestorage.app",
  messagingSenderId: "811789054356",
  appId: "1:811789054356:web:f3a7b957894c33a42b5f81"
};

export default function OwnerNewUserPage() {
  const router = useRouter();
  const [role, setRole] = useState<"worker" | "owner">("worker"); // owner登録も可能に！
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false); // 連打ロック用の防壁

  // 💡【新設】シンプルモダンモーダル用の状態管理インフラ
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"confirm" | "success" | "error">("confirm");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  // フォーム送信時の入り口（window.confirmを撤去し、洗練されたカスタムポップアップを起動）
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      setModalMode("error");
      setModalTitle("⚠️ パスワード文字数不足");
      setModalMessage("初期ログインパスワードは、セキュリティ保持のため6文字以上で設定してください。");
      setModalOpen(true);
      return;
    }

    // 登録確認ポップアップを起動
    setModalMode("confirm");
    setModalTitle("📥 アカウント発行の確認");
    setModalMessage(`新しい ${role === "owner" ? "👑 オーナー" : "👥 ワーカー"} アカウントを作成し、データベースへ登録します。よろしいですか？\n\n対象：${lastName} ${firstName} (${email})`);
    setModalOpen(true);
  };

  // 💡【確定処理】カスタムポップアップ内で「はい、登録する」を押したときに裏でハックを動かすロジック
  const handleExecuteCreateUser = async () => {
    setModalOpen(false); // 登録窓を一旦閉じる
    setSubmitting(true);

    // ★Firebaseの最凶トラップ（オーナーのセッションが上書きされて強制ログアウトされる問題）を完全に防御するハック
    // 「臨時の一時App」をブラウザの裏メモリへ一瞬だけ立ち上げて、そこで安全にアカウントを作成します。
    const tempAppName = `TempApp_${Date.now()}`;
    let tempApp;
    
    try {
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      // 1. 臨時の認証ゲートでユーザーを新規作成（これで現在のオーナーのログインセッションは無傷！）
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const newUid = userCredential.user.uid;

      // 2. メインのFirestoreデータベース（db）の「users」コレクションへプロフィールデータを書き込み
      await setDoc(doc(db, "users", newUid), {
        email: email,
        role: role,
        lastName: lastName,
        firstName: firstName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 💡完了メッセージをWindows標準ではなく、最高にスマートな成功モーダルで表示！
      setModalMode("success");
      setModalTitle("✓ アカウント発行完了");
      setModalMessage(`スタッフ「${lastName} ${firstName}」さんのログインアカウント発行および Firestore データベースへの同期保存が200%完璧に完了しました！`);
      setModalOpen(true);

    } catch (error: any) {
      console.error(error);
      setModalMode("error");
      setModalTitle("❌ アカウント作成失敗");
      
      if (error.code === "auth/email-already-in-use") {
        setModalMessage("指定されたメールアドレスは既にシステム（Firebase Auth）に登録されています。別のアドレスを入力してください。");
      } else {
        setModalMessage("アカウント作成処理中にエラーが発生しました。\n理由: " + error.message);
      }
      setModalOpen(true);
    } finally {
      // 3. 後片付け：使い終わった臨時Appをメモリから安全に抹消
      if (tempApp) {
        await deleteApp(tempApp);
      }
      setSubmitting(false); // ロック解除
    }
  };

  // 成功ポップアップを閉じて一覧へ遷移する関数
  const handleCloseSuccessModal = () => {
    setModalOpen(false);
    router.push("/owner/users"); // 完了後、スタッフ一覧画面へ強制送還
  };

  return (
    <OwnerShell title="スタッフ新規登録" subTitle="管理者によるアカウント手動発行">
      <div className="max-w-md mx-auto bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden text-slate-900 font-sans antialiased mt-6">
        
        {/* レジ風ヘッダー */}
        <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center select-none">
          <span className="text-xs font-black text-slate-700">登録フォーム</span>
          <span className="text-[10px] font-mono font-bold text-slate-400">STAFF ID ISSUANCE</span>
        </div>

        {/* 💡onSubmitを新設したスマートポップアップの検知窓口に差し替え */}
        <form onSubmit={handleFormSubmit} className="p-4 space-y-4">
          
          {/* 権限区分の選択：トグルボタン仕様 */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">権限区分</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("worker")}
                className={`py-2 text-center text-xs font-black border-2 rounded transition-colors ${
                  role === "worker"
                    ? "bg-blue-50 border-blue-400 text-blue-700 font-black"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                👥 ワーカー権限
              </button>
              <button
                type="button"
                onClick={() => setRole("owner")}
                className={`py-2 text-center text-xs font-black border-2 rounded transition-colors ${
                  role === "owner"
                    ? "bg-rose-50 border-rose-400 text-rose-700 font-black"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                👑 オーナー権限
              </button>
            </div>
          </div>

          {/* 姓名入力（2列並び） */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">姓（名字）</label>
              <input
                type="text"
                required
                disabled={submitting}
                placeholder="山田"
                className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] disabled:bg-slate-100"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">名（名前）</label>
              <input
                type="text"
                required
                disabled={submitting}
                placeholder="太郎"
                className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] disabled:bg-slate-100"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          {/* メールアドレス（ID） */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">メールアドレス（ログインID）</label>
            <input
              type="email"
              required
              disabled={submitting}
              placeholder="staff@example.com"
              className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] disabled:bg-slate-100 font-mono"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* パスワード */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block select-none">初期ログインパスワード（6文字以上）</label>
            <input
              type="text" 
              required
              disabled={submitting}
              placeholder="最低6文字以上の英数字"
              className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] disabled:bg-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* 登録ボタン */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? "スタッフアカウント発行中..." : "➕ この内容でスタッフを登録・発行する"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => router.push("/owner/users")}
              className="w-full mt-2 py-2 bg-white border-2 border-slate-300 text-slate-600 text-xs font-black rounded hover:bg-slate-50 transition-colors"
            >
              登録せずに一覧へ戻る
            </button>
          </div>

        </form>
      </div>

      {/* 💡【超シンプル化リフォーム】アカウント発行・登録完了ポップアップも、無駄なフチ線や影のない極上シンプルデザインに完全統一！ */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            {/* ポップアップヘッダー：モードに連動してテーマカラーが上品に変化 */}
            <div className={`px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none text-white ${
              modalMode === "success" ? "bg-emerald-600" : modalMode === "error" ? "bg-rose-600" : "bg-[#0082C8]"
            }`}>
              <span>{modalTitle}</span>
            </div>

            {/* ポップアップ本文 */}
            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {modalMessage}
              </p>
            </div>

            {/* アクションボタンエリア */}
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              {modalMode === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteCreateUser}
                    className="px-4 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
                  >
                    はい、登録する
                  </button>
                </>
              ) : modalMode === "success" ? (
                <button
                  type="button"
                  onClick={handleCloseSuccessModal}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
                >
                  OK（スタッフ一覧へ）
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
                >
                  戻って修正する
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </OwnerShell>
  );
}