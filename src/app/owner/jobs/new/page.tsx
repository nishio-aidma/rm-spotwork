"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

function NewJobForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicateId");
  const { user, loading: authLoading } = useRequireAuth("owner");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobType, setJobType] = useState("form_posting");
  
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("0"); // 初期値を "0" に変更
  const [procedures, setProcedures] = useState(""); 
  const [deadline, setDeadline] = useState(""); 

  const [listName, setListName] = useState(""); 
  const [count, setCount] = useState("");
  const [inputInfo, setInputInfo] = useState("");
  const [formText, setFormText] = useState("");

  const [refUrl, setRefUrl] = useState("");
  const [createCount, setCreateCount] = useState("");
  const [conditions, setConditions] = useState("");

  useEffect(() => {
    async function loadDuplicateData() {
      if (!duplicateId) return;
      try {
        const snap = await getDoc(doc(db, "jobs", duplicateId));
        if (snap.exists()) {
          const d = snap.data();
          setJobType(d.jobType || "form_posting");
          setTitle(`${d.title} (コピー)`);
          setReward(String(d.reward || ""));
          setProcedures(d.procedures || "");
          setDeadline(d.deadline || "");
          setListName(d.listName || "");
          setCount(d.count || "");
          setInputInfo(d.inputInfo || "");
          setFormText(d.formText || "");
          setRefUrl(d.refUrl || "");
          setCreateCount(d.createCount || "");
          setConditions(d.conditions || "");
        }
      } catch (e) { console.error(e); }
    }
    loadDuplicateData();
  }, [duplicateId]);

  const handleSave = async (isDraft: boolean) => {
    if (!user) return;
    if (!title || !reward) { alert("案件名と報酬は必須です"); return; }
    setIsSubmitting(true);
    try {
      const data = {
        jobType, title, reward: Number(reward), procedures, deadline,
        status: isDraft ? "draft" : "open",
        ownerId: user.uid, wishCount: 0, wishedBy: [],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        ...(jobType === "form_posting" ? { listName, count, inputInfo, formText } : { refUrl, createCount, conditions })
      };
      await addDoc(collection(db, "jobs"), data);
      alert(isDraft ? "下書きとして保存しました" : "案件を公開しました");
      router.push("/owner/jobs");
    } catch (e) { alert("保存に失敗しました"); } finally { setIsSubmitting(false); }
  };

  if (authLoading) return null;

  return (
    <OwnerShell title="New Project" subTitle={duplicateId ? "案件の複製" : "新規案件の作成"}>
      <div className="space-y-6">
        <div className="flex rounded-lg bg-slate-200/60 p-1 w-fit">
          <button onClick={() => setJobType("form_posting")} className={`px-5 py-1.5 text-[10px] font-bold rounded-md transition-all ${jobType === "form_posting" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>フォーム投稿</button>
          <button onClick={() => setJobType("list_creation")} className={`px-5 py-1.5 text-[10px] font-bold rounded-md transition-all ${jobType === "list_creation" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>手出しリスト作成</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-white p-4 grid grid-cols-4 gap-6 items-end">
            <div className="col-span-3">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">案件タイトル</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-xs font-bold border-b border-transparent focus:border-indigo-500 outline-none pb-1 bg-transparent" placeholder="案件名を入力..." />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">報酬 (¥)</label>
              <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} className="w-full text-xs font-bold border-b border-transparent focus:border-indigo-500 outline-none pb-1 text-right bg-transparent" placeholder="0" />
            </div>
          </div>

          <div className="p-5 space-y-5">
            {jobType === "form_posting" ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <Input label="リスト名 (SalesCrowd等)" value={listName} onChange={setListName} />
                <Input label="件数" value={count} onChange={setCount} />
                <Input label="稼働期間（期日）" type="date" value={deadline} onChange={setDeadline} />
                <Input label="入力情報" value={inputInfo} onChange={setInputInfo} />
                <div className="col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5">フォーム文面</label>
                  <textarea value={formText} onChange={(e) => setFormText(e.target.value)} className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] font-mono focus:ring-1 focus:ring-indigo-500 outline-none" rows={6} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="col-span-2"><Input label="参照URL" value={refUrl} onChange={setRefUrl} /></div>
                <Input label="作成件数" value={createCount} onChange={setCreateCount} />
                <Input label="納期（期日）" type="date" value={deadline} onChange={setDeadline} />
                <div className="col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5">抽出・検索条件</label>
                  <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none" rows={4} />
                </div>
              </div>
            )}
            <div className="pt-5 border-t border-slate-100">
              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">作業手順・詳細説明</label>
              <textarea value={procedures} onChange={(e) => setProcedures(e.target.value)} className="w-full text-[11px] outline-none bg-slate-50 p-3 rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-500" rows={8} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button type="button" onClick={() => handleSave(true)} disabled={isSubmitting} className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-all">下書き保存</button>
          <button type="button" onClick={() => handleSave(false)} disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-10 py-2 text-[11px] font-bold text-white hover:bg-indigo-700 shadow-md">案件を公開する</button>
        </div>
      </div>
    </OwnerShell>
  );
}

const Input = ({ label, value, onChange, type = "text" }: any) => (
  <div>
    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-200 p-2 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
  </div>
);

export default function OwnerNewJobPage() {
  return (
    <Suspense fallback={null}>
      <NewJobForm />
    </Suspense>
  );
}