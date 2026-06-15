/**
 * MEMBERSチャットツールに通知メッセージを送信する共通関数
 * * 【仕様】
 * ・引数のテキスト内にある改行（\n）を <br> に自動変換します。
 * ・先頭に @all を付与して全員へメンションを飛ばします。
 * ・.env.local の認証トークンとルームIDを自動適用します。
 */
export async function sendMembersNotification(text: string): Promise<boolean> {
    try {
      // 1. 本文の改行コード（\n）を <br> に変換
      const formattedText = text.replace(/\n/g, "<br>");
  
      // 2. 全員宛メンション（@all）を先頭に付与（後ろに半角スペース）
      const bodyMessage = `@all ${formattedText}`;
  
      // 3. APIに送るためのフォームデータを作成（to_idは@allのため空で送信）
      const params = new URLSearchParams();
      params.append("body", bodyMessage);
  
      // 💡【確定】.env.local から本物のトークンとルームIDを安全に読み込みます
      const apiToken = process.env.NEXT_PUBLIC_MEMBERS_API_TOKEN || "";
      const roomId = process.env.NEXT_PUBLIC_MEMBERS_ROOM_ID || "288932"; // 万が一空なら指定のID
  
      // トークンが空の場合はエラーログを出してスキップ（クラッシュ防止）
      if (!apiToken) {
        console.error("MEMBERS通知エラー: トークンが設定されていません。");
        return false;
      }
  
      // 4. 正しいドメインとルームIDを組み合わせてMEMBERSのAPIへデータを送信
      const response = await fetch(`https://api.mem-bers.jp/web-api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // 💡 401エラーを解決するため、正しい合言葉（トークン）をヘッダーにセット
          "Authorization": `Bearer ${apiToken}`,
        },
        body: params,
      });
  
      if (!response.ok) {
        throw new Error(`MEMBERS APIエラー: ${response.status} ${response.statusText}`);
      }
  
      console.log("MEMBERSへの通知送信に成功しました！");
      return true;
    } catch (error) {
      console.error("MEMBERSへの通知送信に失敗しました:", error);
      return false;
    }
  }