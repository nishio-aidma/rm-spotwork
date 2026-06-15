/**
 * MEMBERSチャットツールに通知メッセージを送信する共通関数
 * 【仕様】
 * ・他のシステムで実績のあるロジックを完全再現します。
 * ・本番環境での読み込みエラーを完全に防ぐため、有効なトークンを内部に直接焼き付けます（仕様保持）。
 */
export async function sendMembersNotification(text: string): Promise<boolean> {
  try {
    // 💡【確定】本番環境でも100%読み込めるよう、ご提示いただいた正しいトークンを内部に直接焼き付けます
    const apiToken = "2DdB80HEyHWjO6cnN4YHyjdVR0oNyYebTAuurtFQX0vzZOLh3LhIDltLp45c99BibB5SnG0GcRV2zR35";
    const roomId = process.env.NEXT_PUBLIC_MEMBERS_ROOM_ID || "288932";

    // トークンが空の場合はエラーログを出してスキップ（クラッシュ防止）
    if (!apiToken) {
      console.error("MEMBERS通知エラー: トークンが設定されていません。");
      return false;
    }

    // 1. チャットルームのメンバー一覧を取得する
    const memberUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/members`;
    const memberRes = await fetch(memberUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiToken}` }
    });

    let allMemberIds = "";
    if (memberRes.ok) {
      const memberJson = await memberRes.json();
      // メンバー全員のIDを抽出して、カンマ区切りにする
      const memberIds = (memberJson.member || []).map((obj: any) => obj.id);
      allMemberIds = memberIds.join(",");
    } else {
      console.warn(`MEMBERSメンバー取得失敗: ${memberRes.status}`);
    }

    // 2. 本文の先頭に全員宛の記号を付与（実績コードに合わせ改行は \n のまま扱います）
    const bodyMessage = `@all\n${text}`;

    // 3. APIに送るためのフォームデータを作成
    const formData = new URLSearchParams();
    formData.append("body", bodyMessage);
    formData.append("to_id", allMemberIds);

    // 4. MEMBERSのAPIへデータを送信
    const postUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/messages`;
    const response = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // 実績コードに合わせ、明確に文字列化して送信
      body: formData.toString(),
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