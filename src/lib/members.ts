/**
 * MEMBERSチャットツールに通知メッセージを送信する共通関数
 * 💡【最終確定】アプリ公式の通知API（/api/notify-members）の仕様に100%適合させ、
 * 安全にサーバー経由でメッセージを送信します。
 */
export async function sendMembersNotification(text: string): Promise<boolean> {
  try {
    // 💡公式APIのバリデーション（roomId.length !== 6）を確実にパスするため、文字列として定義します
    const roomId = "288932";

    // アプリが公式に用意している本物の窓口へ通信を繋ぎます
    const response = await fetch("/api/notify-members", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      // 公式API（/api/notify-members）の引数で待ち受けているデータ名に完全一致させます
      body: JSON.stringify({
        roomId: roomId,
        message: text
      })
    });

    if (!response.ok) {
      throw new Error(`公式通知APIエラー: ${response.status}`);
    }

    console.log("アプリ公式APIを経由して、MEMBERSへの通知送信に完全成功しました！");
    return true;
  } catch (error) {
    console.error("MEMBERSへの通知送信に失敗しました:", error);
    return false;
  }
}