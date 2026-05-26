"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";

function JobForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [jobType, setJobType] = useState<'form_posting' | 'list_creation'>('form_posting');
  
  const [formData, setFormData] = useState({
    title: "",
    reward: 0,
    count: 100,      // 予定作業件数
    workerLimit: 1,  // 募集人数
    deadline: "",
    urgency: "1",
    siteUrl: "",
    targetItems: "",
    formContent: "",
    inputInfo: "",
    procedures: ["", "", ""]
  });

  const handleSubmit = async (status: 'open' | 'draft') => {
    if (!auth.currentUser) return;
    setSubmitting(true);

    try {
      await addDoc(collection(db, "jobs"), {
        ...formData,
        jobType,
        ownerId: auth.currentUser.uid,
        status: status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalAccumulatedSeconds: 0
      });
      alert(status === 'open' ? "案件を公開しました" : "下書きとして保存しました");
      router.push("/owner/jobs");
    } catch (error) {
      alert("エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcedureChange = (index: number, value: string) => {
    const newProcedures = [...formData.procedures];
    newProcedures[index] = value;
    setFormData({ ...formData, procedures: newProcedures });
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 text-slate-800">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-12">
        {/* 基本設定 */}
        <section className="space-y-6">
          <h2 className="text-sm font-bold border-l-4 border-slate-900 pl-3">基本設定</h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={() => setJobType('form_posting')}
                className={`py-3 rounded-lg text-xs font-bold transition-all border ${jobType === 'form_posting' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}
              >
                ✉️ フォーム投稿
              </button>
              <button 
                type="button"
                onClick={() => setJobType('list_creation')}
                className={`py-3 rounded-lg text-xs font-bold transition-all border ${jobType === 'list_creation' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}
              >
                📋 リスト作成
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">案件タイトル</label>
              <input 
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">報酬 (￥)</label>
                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.reward} onChange={e => setFormData({...formData, reward: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">作業件数</label>
                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.count} onChange={e => setFormData({...formData, count: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">募集人数</label>
                <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.workerLimit} onChange={e => setFormData({...formData, workerLimit: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">優先度</label>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})}>
                  <option value="1">通常</option>
                  <option value="2">高め</option>
                  <option value="3">至急</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">期日</label>
              <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
          </div>
        </section>

        {/* 作業詳細：ここが不足していました */}
        <section className="space-y-6">
          <h2 className="text-sm font-bold border-l-4 border-slate-900 pl-3">作業詳細</h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
            {jobType === 'form_posting' ? (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">送信文面内容</label>
                  <textarea rows={6} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.formContent} onChange={e => setFormData({...formData, formContent: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">その他、入力が必要な情報</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="担当者名、部署名など" value={formData.inputInfo} onChange={e => setFormData({...formData, inputInfo: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">抽出サイトURL</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.siteUrl} onChange={e => setFormData({...formData, siteUrl: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">抽出・収集する項目</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="社名、電話番号など" value={formData.targetItems} onChange={e => setFormData({...formData, targetItems: e.target.value})} />
                </div>
              </>
            )}
          </div>
        </section>

        {/* 作業手順：ここも不足していました */}
        <section className="space-y-6">
          <h2 className="text-sm font-bold border-l-4 border-slate-900 pl-3">具体的な手順 (3ステップ)</h2>
          <div className="space-y-3">
            {formData.procedures.map((p, i) => (
              <div key={i} className="flex gap-4 items-center">
                <span className="text-xs font-bold text-slate-300">0{i+1}</span>
                <input 
                  className="flex-1 p-4 bg-white border border-slate-200 rounded-lg text-sm" 
                  placeholder={`手順 ${i+1} を入力`}
                  value={p}
                  onChange={e => handleProcedureChange(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="pt-10 flex gap-4">
          <button type="button" onClick={() => router.back()} className="px-6 py-4 text-xs font-bold text-slate-400">キャンセル</button>
          <div className="flex-1 flex gap-3">
            <button 
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={submitting}
              className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              下書きとして保存
            </button>
            <button 
              type="button"
              onClick={() => handleSubmit('open')}
              disabled={submitting}
              className="flex-[1.5] py-4 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
            >
              {submitting ? "処理中..." : "案件を公開する"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewJobPage() {
  return (
    <OwnerShell title="新規案件の作成" subTitle="案件の掲載設定">
      <Suspense fallback={<div className="p-10 text-center text-slate-400">Loading...</div>}>
        <JobForm />
      </Suspense>
    </OwnerShell>
  );
}