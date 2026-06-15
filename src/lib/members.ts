/**
 * MEMBERSチャットツールに通知メッセージを送信する共通関数
 * * 【仕様】
 * ・引数のテキスト内にある改行（\n）を <br> に自動変換します。
 * ・先頭に @all を付与して全員へメンションを飛ばします。
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
  
      // 4. MEMBERSのAPIへデータを送信
      // 💡確定した本番用ドメイン（https://api.mem-bers.jp/web-api）を設定しました
      const response = await fetch("https://api.mem-bers.jp/web-api/rooms/288932/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // もし今後、API Tokenなどの認証が必要だと分かった場合はここに追記します
        },
        body: params,
      });
  
      if (!response.ok) {
        throw new Error(`MEMBERS APIエラー: ${response.status} ${response.statusText}`);
      }
  
      console.log("MEMBERSへの通知送信に成功しました。");
      return true;
    } catch (error) {
      console.error("MEMBERSへの通知送信に失敗しました:", error);
      return false;
    }
  }