"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";
import { useRouter } from "next/navigation";

export default function OwnerJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 編集用のローカルステート
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    async function fetchJob() {
      const snap = await getDoc(doc(db, "jobs", id));
      if (snap.exists()) {
        const data = snap.data();
        setJob(data);
        setEditData(data);
      }
      setLoading(false);
    }
    fetchJob();
  }, [id]);

  // 保存処理
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "jobs", id), editData);
      setJob(editData);
      setIsEditing(false);
      alert("案件情報を更新しました");
    } catch (e) {
      alert("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 取り下げ処理
  const handleWithdraw = async () => {
    if (!confirm("この案件を取り下げて下書きに戻しますか？\n※ワーカーからは閲覧できなくなります。")) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "jobs", id), { status: 'draft' });
      setJob({ ...job, status: 'draft' });
      alert("案件を取り下げました");
    } catch (e) {
      alert("操作に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <OwnerShell title="読み込み中..."><div className="p-20 text-center text-slate-400">Loading...</div></OwnerShell>;
  if (!job) return <OwnerShell title="Error">案件が見つかりません</OwnerShell>;

  return (
    <OwnerShell title="案件詳細・管理" subTitle={isEditing ? "案件情報の編集" : "掲載内容の確認"}>
      <div className="max-w-4xl mx-auto space-y-8 pb-20 text-slate-800">
        
        {/* ヘッダー操作エリア */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-6">
          <div className="space-y-2">
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase flex items-center gap-1">
              ← Back to List
            </button>
            {isEditing ? (
              <input 
                className="text-2xl font-bold bg-slate-50 border-b-2 border-slate-900 focus:outline-none w-full"
                value={editData.title}
                onChange={e => setEditData({...editData, title: e.target.value})}
              />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
            )}
            <div className="flex gap-2 items-center">
              <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase ${
                job.status === 'open' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}>
                {job.status === 'open' ? '募集中' : '下書き'}
              </span>
              <span className="text-[10px] font-bold text-slate-300 uppercase">
                {job.jobType === 'form_posting' ? '✉️ Form Posting' : '📋 List Creation'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">キャンセル</button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-lg disabled:opacity-50">
                  {saving ? "保存中..." : "変更を保存"}
                </button>
              </>
            ) : (
              <>
                {job.status === 'open' && (
                  <button onClick={handleWithdraw} className="px-4 py-2 text-rose-500 text-xs font-bold border border-rose-100 rounded-lg hover:bg-rose-50 transition-all">
                    取り下げる
                  </button>
                )}
                <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-sm transition-all">
                  🛠️ 案件を修正する
                </button>
              </>
            )}
          </div>
        </div>

        {/* メイングリッド情報：SCクライアントを追加し、5列構成に調整 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 py-8 border-b border-slate-50">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">報酬</p>
            {isEditing ? (
              <input type="number" className="text-sm font-bold w-full bg-slate-50 p-1" value={editData.reward} onChange={e => setEditData({...editData, reward: Number(e.target.value)})} />
            ) : (
              <p className="text-sm font-bold">¥{job.reward?.toLocaleString()}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {job.jobType === 'form_posting' ? '入力付帯情報' : '抽出サイト'}
            </p>
            {isEditing ? (
              <input 
                className="text-sm font-bold w-full bg-slate-50 p-1" 
                value={job.jobType === 'form_posting' ? editData.inputInfo : editData.siteUrl} 
                onChange={e => setEditData({
                  ...editData, 
                  [job.jobType === 'form_posting' ? 'inputInfo' : 'siteUrl']: e.target.value
                })} 
              />
            ) : (
              <p className="text-sm font-bold truncate">
                {job.jobType === 'form_posting' ? (job.inputInfo || "-") : (job.siteUrl || "-")}
              </p>
            )}
          </div>

          {/* ★ SCクライアント項目を追加 */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SCクライアント</p>
            {isEditing ? (
              <input 
                className="text-sm font-bold w-full bg-slate-50 p-1" 
                value={editData.scClient || ""} 
                onChange={e => setEditData({...editData, scClient: e.target.value})} 
              />
            ) : (
              <p className="text-sm font-bold text-slate-800">{job.scClient || "-"}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">募集人数</p>
            {isEditing ? (
              <input type="number" className="text-sm font-bold w-full bg-slate-50 p-1" value={editData.workerLimit} onChange={e => setEditData({...editData, workerLimit: Number(e.target.value)})} />
            ) : (
              <p className="text-sm font-bold">{job.workerLimit || 1}名</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">予定件数</p>
            {isEditing ? (
              <input type="number" className="text-sm font-bold w-full bg-slate-50 p-1" value={editData.count} onChange={e => setEditData({...editData, count: Number(e.target.value)})} />
            ) : (
              <p className="text-sm font-bold">{job.count}件</p>
            )}
          </div>
        </div>

        {/* 作業内容詳細 */}
        <div className="grid grid-cols-1 gap-10">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {job.jobType === 'form_posting' ? '送信文面 / 作業指示' : '収集項目リスト'}
            </h3>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 min-h-[150px]">
              {isEditing ? (
                <textarea 
                  rows={8}
                  className="w-full bg-transparent text-sm leading-relaxed focus:outline-none"
                  value={job.jobType === 'form_posting' ? editData.formContent : editData.targetItems}
                  onChange={e => setEditData({
                    ...editData, 
                    [job.jobType === 'form_posting' ? 'formContent' : 'targetItems']: e.target.value
                  })}
                />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                  {job.jobType === 'form_posting' ? job.formContent : job.targetItems}
                </p>
              )}
            </div>
          </div>

          {/* 手順の表示 */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">作業手順</h3>
            <div className="space-y-3">
              {(isEditing ? editData.procedures : job.procedures || []).map((p: string, i: number) => (
                <div key={i} className="flex gap-4 items-center bg-white border border-slate-100 p-4 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-300">0{i+1}</span>
                  {isEditing ? (
                    <input 
                      className="flex-1 text-sm outline-none" 
                      value={p} 
                      onChange={e => {
                        const newPro = [...editData.procedures];
                        newPro[i] = e.target.value;
                        setEditData({...editData, procedures: newPro});
                      }}
                    />
                  ) : (
                    <p className="text-sm font-medium">{p || "未設定"}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}