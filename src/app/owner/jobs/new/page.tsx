"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

export default function NewJobPage() {
  const { user } = useRequireAuth("owner");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [count, setCount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [urgency, setUrgency] = useState("1"); // 緊急性の追加
  const [jobType, setJobType] = useState<"form_posting" | "list_creation">("form_posting");
  const [procedures, setProcedures] = useState([""]);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "list_creation") setJobType("list_creation");
    
    const urlParam = searchParams.get("url");
    const titleParam = searchParams.get("title");
    if (urlParam && titleParam) {
      setTitle(titleParam);
      setDescription(`対象URL: ${urlParam}`);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await addDoc(collection(db, "jobs"), {
        ownerId: user.uid,
        title,
        description,
        reward: Number(reward),
        count: Number(count),
        deadline,
        urgency, // 保存データに追加
        jobType,
        procedures: procedures.filter(p => p.trim() !== ""),
        status: "open",
        createdAt: serverTimestamp(),
      });
      router.push("/owner/dashboard");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OwnerShell title="New Job" subTitle="案件作成">
      <div className="max-w-2xl mx-auto pb-20">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">案件タイトル</label>
            <input
              type="text"
              required
              className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：お問い合わせフォーム投稿代行"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">報酬 (1件あたり/円)</label>
              <input
                type="number"
                required
                className="w-full p-3 text-sm border border-slate-200 rounded-xl"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">予定件数</label>
              <input
                type="number"
                required
                className="w-full p-3 text-sm border border-slate-200 rounded-xl"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">期日</label>
            <input
              type="date"
              required
              className="w-full p-3 text-sm border border-slate-200 rounded-xl"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* 緊急性の選択欄 */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">緊急性</label>
            <select 
              className="w-full p-3 text-sm border border-slate-200 rounded-xl bg-white"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              <option value="1">低（通常）</option>
              <option value="2">中（優先）</option>
              <option value="3">高（至急！）</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">詳細説明</label>
            <textarea
              className="w-full p-3 text-sm border border-slate-200 rounded-xl h-32"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
          >
            {loading ? "作成中..." : "案件を公開する"}
          </button>
        </form>
      </div>
    </OwnerShell>
  );
}