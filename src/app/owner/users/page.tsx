"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerWorkersPage() {
  const { user: owner, loading: authLoading } = useRequireAuth("owner");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 全アカウントを取得して新着順に並べ替える（仕分けはJSX側で物理的に行います）
  const fetchAllUsers = async () => {
    if (!owner) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const userList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      
      // 全体を一括で登録日の新しい順（新着順）にソート
      userList.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setUsers(userList);
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchAllUsers();
  }, [owner, authLoading]);

  // アカウントの完全削除ロジック
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === auth.currentUser?.uid) {
      alert("現在ログイン中のご自身のアカウントは削除できません。");
      return;
    }

    const ok = window.confirm(`【警告】このスタッフアカウントを完全に削除しますか？\n\n対象：${userName}\n※この操作は取り消せません。`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(prev => prev.filter(u => u.id !== userId));
      alert("アカウントを完全に削除しました。");
    } catch (e) {
      console.error(e);
      alert("削除処理に失敗しました。");
    }
  };

  if (authLoading || loading) return <OwnerShell title="アカウント管理"><div className="p-10 text-center text-slate-400 text-xs font-bold">アカウント台帳を照合中...</div></OwnerShell>;

  // 💡【物理枠分離ハック】全体のデータから、オーナー枠用とワーカー枠用にその場でパキッと切り分ける
  const owners = users.filter((u: any) => u.role === 'owner');
  const workers = users.filter((u: any) => u.role !== 'owner');

  return (
    <OwnerShell title="アカウント管理" subTitle="登録スタッフ（オーナー／ワーカー）の登録状況一覧">
      <div className="max-w-full mx-auto space-y-6 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 1. 上部カウンターパネル */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex justify-between items-center flex-wrap gap-3">
          <div className="text-sm font-black text-slate-700">
            登録済み総アカウント数: <span className="text-lg text-[#0082C8] font-black">{users.length}</span> 名
          </div>
          <Link 
            href="/owner/users/new"
            className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded border border-black/10 transition-colors shadow-sm text-center"
          >
            ➕ 新規スタッフを登録する
          </Link>
        </div>

        {/* 2. 【独立枠その1】👑 オーナー（管理者）アカウント台帳 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-black px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-300 rounded uppercase">OWNER DIRECTORY</span>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">管理者アカウント台帳 ({owners.length}名)</h3>
          </div>
          
          <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                  <tr>
                    <th className="p-3 border-r border-slate-300 w-28 text-center">権限区分</th>
                    <th className="p-3 border-r border-slate-300">スタッフ氏名</th>
                    <th className="p-3 border-r border-slate-300">連絡先（メールアドレス）</th>
                    <th className="p-3 border-r border-slate-300 w-44">システム登録日</th>
                    <th className="p-3 w-28 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                  {owners.map((u) => {
                    const fullName = `${u.lastName || ""} ${u.firstName || u.name || "不明"}`;
                    const isMe = u.id === auth.currentUser?.uid;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r border-slate-200">
                          <span className="bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 text-[10px] font-black rounded block text-center uppercase">オーナー</span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-slate-900">
                          {fullName} {isMe && <span className="text-[10px] text-slate-400 font-normal">（あなた）</span>}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-mono">{u.email}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "-"}</td>
                        <td className="p-3 text-center flex items-center justify-center gap-3">
                          <Link href={`/owner/users/${u.id}`} className="text-[#0082C8] hover:underline font-black text-[11px]">詳細 →</Link>
                          {!isMe ? (
                            <button onClick={() => handleDeleteUser(u.id, fullName)} className="text-slate-300 hover:text-rose-600 transition-colors p-1" title="削除">🗑️</button>
                          ) : <div className="w-5" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. 【独立枠その2】👥 ワーカー（作業者）アカウント台帳 */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-black px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-300 rounded uppercase">WORKER DIRECTORY</span>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">作業者アカウント台帳 ({workers.length}名)</h3>
          </div>

          <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                  <tr>
                    <th className="p-3 border-r border-slate-300 w-28 text-center">権限区分</th>
                    <th className="p-3 border-r border-slate-300">スタッフ氏名</th>
                    <th className="p-3 border-r border-slate-300">連絡先（メールアドレス）</th>
                    <th className="p-3 border-r border-slate-300 w-44">システム登録日</th>
                    <th className="p-3 w-28 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                  {workers.map((u) => {
                    const fullName = `${u.lastName || ""} ${u.firstName || u.name || "不明"}`;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r border-slate-200">
                          <span className="bg-blue-50 text-blue-700 border border-blue-300 px-2 py-0.5 text-[10px] font-black rounded block text-center uppercase">ワーカー</span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-slate-900">{fullName}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-600 font-mono">{u.email}</td>
                        <td className="p-3 border-r border-slate-200 text-slate-500">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "-"}</td>
                        <td className="p-3 text-center flex items-center justify-center gap-3">
                          <Link href={`/owner/users/${u.id}`} className="text-[#0082C8] hover:underline font-black text-[11px]">詳細 →</Link>
                          <button onClick={() => handleDeleteUser(u.id, fullName)} className="text-slate-300 hover:text-rose-600 transition-colors p-1" title="削除">🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {workers.length === 0 && (
              <div className="p-10 text-center text-slate-400 italic font-medium bg-slate-50">登録されているワーカーはまだいません。</div>
            )}
          </div>
        </div>

      </div>
    </OwnerShell>
  );
}