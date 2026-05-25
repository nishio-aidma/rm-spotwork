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

  useEffect(() => {
    async function fetchRanks() {
      const snap = await getDoc(doc(db, "settings", "rank_config"));
      if (snap.exists()) setRanks(snap.data().ranks);
    }
    fetchRanks();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "rank_config"), { ranks });
      alert("保存しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OwnerShell title="Rank Settings" subTitle="ランク条件">
      <div className="max-w-xl font-sans text-slate-600">
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 font-medium text-slate-400 text-left w-1/2">ランク名</th>
                <th className="py-3 font-medium text-slate-400 text-left">必要時間 (h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranks.map((rank, i) => (
                <tr key={i}>
                  <td className="py-4">
                    <input 
                      type="text" value={rank.name} 
                      onChange={(e) => {
                        const next = [...ranks];
                        next[i].name = e.target.value;
                        setRanks(next);
                      }}
                      className="bg-transparent border-none p-0 focus:ring-0 text-slate-900 font-medium"
                    />
                  </td>
                  <td className="py-4">
                    <input 
                      type="number" value={rank.hours} 
                      onChange={(e) => {
                        const next = [...ranks];
                        next[i].hours = Number(e.target.value);
                        setRanks(next);
                      }}
                      className="bg-transparent border-b border-slate-200 p-0 focus:ring-0 focus:border-slate-900 w-16 text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <button 
          onClick={save} 
          disabled={saving} 
          className="text-xs font-bold text-slate-900 border border-slate-900 px-6 py-2 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30"
        >
          {saving ? "SAVING..." : "設定を適用する"}
        </button>
      </div>
    </OwnerShell>
  );
}