"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth"; // 💡 認証のすれ違いを防ぐために追加
import WorkerShell from "@/components/WorkerShell";
import Link from "next/link";

export default function WorkerJobsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'wishlist'>('all');
  const [jobs, setJobs] = useState<any[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishJobs, setWishJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null); // 💡 ログインユーザーを確実に保持するステート

  // ログイン情報確定後にデータを安全に一括ロードする関数
  const fetchJobsAndWishlist = async (userId: string) => {
    try {
      const jobSnap = await getDocs(collection(db, "jobs"));
      const allJobs = jobSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      
      // 2段階絶対優先ソート（1:緊急度順 ➔ 2:期日順）
      allJobs.sort((a: any, b: any) => {
        const urgencyA = Number(a.urgency || "1");
        const urgencyB = Number(b.urgency || "1");
        if (urgencyA !== urgencyB) return urgencyB - urgencyA;

        const deadlineA = a.deadline && a.deadline.trim() !== "" ? a.deadline : "9999-12-31";
        const deadlineB = b.deadline && b.deadline.trim() !== "" ? b.deadline : "9999-12-31";
        if (deadlineA !== deadlineB) return deadlineA.localeCompare(deadlineB);

        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      const openJobs = allJobs.filter((j: any) => j.status === "open");

      // 💡 userIdを引数から確実に受け取ってウィッシュリストを直撃取得
      const wishSnap = await getDocs(query(collection(db, "wishlists"), where("workerId", "==", userId)));
      const wishes = wishSnap.docs.map(d => d.data().jobId);

      const wishedJobData = allJobs.filter((j: any) => wishes.includes(j.id) && j.status === "open");

      setJobs(openJobs);
      setWishlistIds(wishes);
      setWishJobs(wishedJobData);
    } catch (e) {
      console.error("データ取得エラー:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 💡 画面起動時にFirebaseの認証完了イベントをガチッとフックして待ち受ける
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchJobsAndWishlist(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleWish = async (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    if (!currentUser) return;

    const wishDocId = `${currentUser.uid}_${jobId}`;
    const wishRef = doc(db, "wishlists", wishDocId);
    const isWished = wishlistIds.includes(jobId);

    try {
      if (isWished) {
        await deleteDoc(wishRef);
        setWishlistIds(prev => prev.filter(id => id !== jobId));
        setWishJobs(prev => prev.filter(j => j.id !== jobId));
      } else {
        await setDoc(wishRef, {
          workerId: currentUser.uid,
          jobId: jobId,
          createdAt: new Date()
        });
        setWishlistIds(prev => [...prev, jobId]);
        const targetJob = jobs.find(j => j.id === jobId);
        if (targetJob) setWishJobs(prev => [...prev, targetJob]);
      }
    } catch (e) {
      console.error("ウィッシュリストの更新に失敗しました:", e);
    }
  };

  if (loading) return <WorkerShell title="案件を探す"><div className="p-10 text-center text-slate-400 text-xs font-bold">クラウド台帳をロード中...</div></WorkerShell>;

  return (
    <WorkerShell title="案件を探す" subTitle="現在募集中の業務一覧およびキープ中の案件">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 上部：2大タブ（1ミリも揺れない統一デザイン） */}
        <div className="grid grid-cols-2 bg-white border-2 border-slate-300 rounded p-1 gap-1 shadow-sm select-none h-11 items-stretch">
          <button 
            type="button"
            onClick={() => setActiveTab('all')}
            className={`text-center text-xs font-black rounded transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'all' ? 'bg-[#0082C8] text-white shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            🔍 募集中の案件 ({jobs.length})
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('wishlist')}
            className={`text-center text-xs font-black rounded transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'wishlist' ? 'bg-amber-400 text-slate-900 shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            ★ ウィッシュリスト ({wishJobs.length})
          </button>
        </div>

        {/* タブ1: 募集中の案件一覧 */}
        {activeTab === 'all' && (
          <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              {/* table-fixedに変更し、列の比率を他の画面と完全同期 */}
              <table className="w-full text-left border-collapse table-fixed text-xs min-w-[1000px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black">
                  <tr>
                    <th className="p-3 border-r border-slate-300 w-12 text-center">保存</th>
                    <th className="p-3 border-r border-slate-300 w-20 text-center">緊急度</th>
                    <th className="p-3 border-r border-slate-300 w-26 text-center">仕事種別</th>
                    <th className="p-3 border-r border-slate-300">案件タイトル</th>
                    <th className="p-3 border-r border-slate-300 w-20 text-right">件数</th>
                    <th className="p-3 border-r border-slate-300 w-28 text-center">期日</th>
                    <th className="p-3 border-r border-slate-300 w-44">SCクライアント</th>
                    <th className="p-3 w-20 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium bg-white">
                  {jobs.map((job) => {
                    const isWished = wishlistIds.includes(job.id);
                    const rowBgClass = job.urgency === "3" 
                      ? "bg-rose-100/50 hover:bg-rose-200/60" 
                      : job.urgency === "2"
                      ? "bg-amber-100/50 hover:bg-amber-200/60" 
                      : "bg-white hover:bg-slate-50";

                    return (
                      <tr key={job.id} className={`${rowBgClass} transition-colors`}>
                        <td className="p-3 border-r border-slate-200 text-center select-none">
                          <button type="button" onClick={(e) => toggleWish(e, job.id)} className={`text-sm transition-transform active:scale-125 block w-full h-full text-center ${isWished ? "text-amber-400 font-bold" : "text-slate-300 hover:text-slate-400"}`}>
                            {isWished ? "★" : "☆"}
                          </button>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center">
                          {job.urgency === "3" ? (
                            <span className="bg-rose-200 text-rose-900 border border-rose-400 font-black px-1.5 py-0.5 rounded text-[10px] uppercase block animate-pulse">至急</span>
                          ) : job.urgency === "2" ? (
                            <span className="bg-amber-200 text-amber-900 border border-amber-400 font-black px-1.5 py-0.5 rounded text-[10px] block">高め</span>
                          ) : (
                            <span className="bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] block">通常</span>
                          )}
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          <span className="bg-white/90 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-bold block text-center shadow-sm">
                            {job.jobType === 'form_posting' ? '✉️ フォーム' : '📋 リスト作成'}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-black text-slate-950 truncate">
                          <Link 
                            href={`/worker/jobs/${job.id}`} 
                            className="hover:underline hover:text-[#0082C8] transition-colors block w-full truncate"
                          >
                            {job.title}
                          </Link>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-sm text-slate-700">
                          {job.count || 0} 件
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center font-mono font-black text-sm text-slate-600">
                          {job.deadline ? job.deadline : <span className="text-slate-300 font-normal text-xs">未設定</span>}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-slate-700 truncate" title={job.scClient}>{job.scClient || "-"}</td>
                        <td className="p-3 text-center">
                          <Link href={`/worker/jobs/${job.id}`} className="text-[#0082C8] hover:underline font-black text-[11px] block active:scale-95 transition-transform">確認 →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {jobs.length === 0 && <div className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">現在、募集中の案件はありません。</div>}
          </div>
        )}

        {/* タブ2: ウィッシュリスト（保存中）一覧 */}
        {activeTab === 'wishlist' && (
          <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed text-xs min-w-[1000px]">
                <thead className="bg-amber-50 border-b-2 border-amber-300 text-slate-700 font-black">
                  <tr>
                    <th className="p-3 border-r border-amber-200 w-12 text-center">解除</th>
                    <th className="p-3 border-r border-amber-200 w-20 text-center">緊急度</th>
                    <th className="p-3 border-r border-amber-200 w-26 text-center">仕事種別</th>
                    <th className="p-3 border-r border-amber-200">キープ案件名</th>
                    <th className="p-3 border-r border-amber-200 w-20 text-right">件数</th>
                    <th className="p-3 border-r border-amber-200 w-28 text-center">期日</th>
                    <th className="p-3 border-r border-amber-200 w-44">SCクライアント</th>
                    <th className="p-3 w-20 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-medium bg-white">
                  {wishJobs.map((job) => {
                    const rowBgClass = job.urgency === "3" 
                      ? "bg-rose-100/50 hover:bg-rose-200/60" 
                      : job.urgency === "2"
                      ? "bg-amber-100/50 hover:bg-amber-200/60" 
                      : "bg-white hover:bg-slate-50";

                    return (
                      <tr key={job.id} className={`${rowBgClass} transition-colors`}>
                        <td className="p-3 border-r border-slate-200 text-center select-none">
                          <button type="button" onClick={(e) => toggleWish(e, job.id)} className="text-slate-300 hover:text-rose-600 transition-colors text-xs block w-full text-center" title="キープを解除">❌</button>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center">
                          {job.urgency === "3" ? (
                            <span className="bg-rose-200 text-rose-900 border border-rose-400 font-black px-1.5 py-0.5 rounded text-[10px] uppercase block animate-pulse">至急</span>
                          ) : job.urgency === "2" ? (
                            <span className="bg-amber-200 text-amber-900 border border-amber-400 font-black px-1.5 py-0.5 rounded text-[10px] block">高め</span>
                          ) : (
                            <span className="bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] block">通常</span>
                          )}
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          <span className="bg-white/80 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-bold block text-center shadow-sm">
                            {job.jobType === 'form_posting' ? '✉️ フォーム' : '📋 リスト作成'}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-black text-slate-950 truncate">
                          <Link 
                            href={`/worker/jobs/${job.id}`} 
                            className="hover:underline hover:text-[#0082C8] transition-colors block w-full truncate"
                          >
                            {job.title}
                          </Link>
                        </td>
                        <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-sm text-slate-700">
                          {job.count || 0} 件
                        </td>
                        <td className="p-3 border-r border-slate-200 text-center font-mono font-black text-sm text-slate-600">
                          {job.deadline ? job.deadline : <span className="text-slate-300 font-normal text-xs">未設定</span>}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-slate-700 truncate" title={job.scClient}>{job.scClient || "-"}</td>
                        <td className="p-3 text-center">
                          <Link href={`/worker/jobs/${job.id}`} className="text-[#0082C8] hover:underline font-black block active:scale-95 transition-transform">確認 →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {wishJobs.length === 0 &&  <div className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">ウィッシュリストに保存されているお仕事はありません。</div>}
          </div>
        )}

      </div>
    </WorkerShell>
  );
}