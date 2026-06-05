"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

const DEFAULT_RANKS = [
  { name: "ROOKIE", hours: 0 },
  { name: "BRONZE", hours: 10 },
  { name: "SILVER", hours: 50 },
  { name: "GOLD", hours: 100 },
];

export default function RankSettingsPage() {
  const { user } = useRequireAuth("owner");
  const [ranks, setRanks] = useState(DEFAULT_RANKS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRanks() {
      try {
        const snap = await getDoc(doc(db, "settings", "rank_config"));
        if (snap.exists()) setRanks(snap.data().ranks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRanks();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "rank_config"), { ranks });
      alert("ランク設定を更新しました。");
    } catch (e) {
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <OwnerShell title="ランク設定"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></OwnerShell>;

  return (
    <OwnerShell title="ランク設定" subTitle="昇格条件のカスタマイズ">
      <div className="max-w-2xl space-y-8 font-sans text-slate-800 pb-20">
        
        {/* インフォメーション */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
          <span className="text-xl">🏆</span>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            ワーカーの総稼働時間に応じたランク名を定義します。<br />
            設定した「必要時間」に達すると、ワーカーのプロフィールにランクが反映されます。
          </p>
        </div>

        {/* ランク設定テーブル */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ランク名称</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">必要稼働時間 (h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranks.map((rank, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <input 
                      type="text" 
                      value={rank.name} 
                      onChange={(e) => {
                        const next = [...ranks];
                        next[i].name = e.target.value;
                        setRanks(next);
                      }}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-800 placeholder-slate-300"
                      placeholder="ランク名を入力"
                    />
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="number" 
                        value={rank.hours} 
                        onChange={(e) => {
                          const next = [...ranks];
                          next[i].hours = Number(e.target.value);
                          setRanks(next);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-slate-700 w-24 text-right outline-none focus:border-slate-400 focus:bg-white transition-all"
                      />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">h</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* アクションボタン */}
        <div className="flex justify-end pt-4">
          <button 
            onClick={save} 
            disabled={saving} 
            className="bg-slate-900 text-white px-10 py-3.5 rounded-2xl text-[11px] font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存する"}
          </button>
        </div>
      </div>
    </OwnerShell>
  );
}