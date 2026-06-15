/**
 * MEMBERSチャットツールに通知メッセージを送信する共通関数
 * 💡CORS制限を回避するため、新設した自社中継サーバーAPI（/api/members）を経由して送信します。
 */
export async function sendMembersNotification(text: string): Promise<boolean> {
  try {
    // 直接外部に飛ばさず、自社のNext.js中継サーバーにメッセージを預ける
    const response = await fetch("/api/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) {
      throw new Error(`中継サーバーエラー: ${response.status}`);
    }

    console.log("サーバー経由でのMEMBERS通知送信に成功しました！");
    return true;
  } catch (error) {
    console.error("MEMBERSへの通知送信に失敗しました（中継失敗）:", error);
    return false;
  }
}