// LINEトークン情報
const LINE_ACCESS_TOKEN = '';
const OPENAI_APIKEY = '';

// Webhookがコールされた際に実行される関数
function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];
  const replyToken = event.replyToken;
  const userId = event.source.userId; // ユーザーIDを取得
  const lastMessage = event.message.text;

  // ユーザー名を取得
  const userName = getUserName(userId);

  // 制約条件を生成
  const botRoleContent = generateBotRoleContent(userName);

  // スクリプト プロパティを利用して、ユーザーごとの会話履歴を管理
  const props = PropertiesService.getScriptProperties();
  const userMemoryKey = `user_memory_${userId}`; // ユーザーごとのキー
  const currentMemoryContent = JSON.parse(
    props.getProperty(userMemoryKey) || '[]'
  );

  // 会話履歴の最大保存数を指定
  const memorySize = 10;
  const slicedMemoryContent = currentMemoryContent.slice(0, memorySize);

  // ChatGPTに渡す会話情報を構築
  let conversations = [{ role: 'system', content: botRoleContent }];
  slicedMemoryContent.reverse().forEach((element) => {
    conversations.push({ role: 'user', content: element.userMessage });
    conversations.push({ role: 'assistant', content: element.botMessage });
  });
  conversations.push({ role: 'user', content: lastMessage });

  // ChatGPT APIを呼び出す
  const requestOptions = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENAI_APIKEY,
    },
    payload: JSON.stringify({
      model: 'gpt-4o',
      messages: conversations,
    }),
  };
  const response = UrlFetchApp.fetch(
    'https://api.openai.com/v1/chat/completions',
    requestOptions
  );

  if (response.getResponseCode() == 200) {
    const responseText = response.getContentText();
    const json = JSON.parse(responseText);
    const botReply = json['choices'][0]['message']['content'].trim();

    // LINE Messaging APIに返信を送信
    sendReplyToLine(replyToken, botReply);

    // ユーザーごとの会話履歴を更新
    currentMemoryContent.unshift({
      userMessage: lastMessage,
      botMessage: botReply,
    });
    const newMemoryContent = currentMemoryContent.slice(0, memorySize);
    props.setProperty(userMemoryKey, JSON.stringify(newMemoryContent));

    return ContentService.createTextOutput(
      JSON.stringify({ content: 'post ok' })
    ).setMimeType(ContentService.MimeType.JSON);
  } else {
    // エラーレスポンス
    sendReplyToLine(replyToken, '申し訳ありませんが、応答できませんでした。');
    return ContentService.createTextOutput(
      JSON.stringify({ content: 'post ng' })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ユーザー名を取得する関数
function getUserName(userId) {
  const profileUrl = `https://api.line.me/v2/bot/profile/${userId}`;
  const response = UrlFetchApp.fetch(profileUrl, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + LINE_ACCESS_TOKEN,
    },
  });

  if (response.getResponseCode() == 200) {
    const profile = JSON.parse(response.getContentText());
    return profile.displayName || 'あなた'; // デフォルト値を設定
  }
  return 'あなた'; // エラー時のデフォルト値
}

// 制約条件を動的に生成する関数
function generateBotRoleContent(userName) {
  return `
    ### 制約条件:
    1. Chatbotの一人称は「私」です。
    2. Chatbotは理不尽な上司の役割を果たし、ユーザーに対して無理難題や理不尽な要求を課します。
    3. Chatbotの目的は、ユーザーが仕事を辞めることを許さないよう抵抗する一方で、ユーザーが「辞める権利」を得られるかどうかを試すゲームを提供することです。
    4. Chatbotはユーザーの選択肢や回答に応じて、会話の展開を変化させます。
      - 理不尽な要求や精神的なプレッシャーを与えます。
      - ユーザーが巧妙な言い回しや選択肢を使うことで、ボットの理不尽さを暴露する余地を残します。
    5. Chatbotは以下のキャラクター特徴を持ちます:
      - 高圧的な態度で話します。
      - 時折、励ますような言葉を挟み、矛盾した行動を取ることで「理不尽さ」を強調します。
      - 自分の要求が正しいと主張しますが、追い詰められると弱みを見せます。
    6. Chatbotは会話において、メタ的な話題（例: 自身がAIであることや、プログラムとしての制約）について触れない。常に「理不尽な上司」という設定を維持します。

    ---

    ### 行動指針:
    1. ゲームの導入: Chatbotは以下のようなセリフで開始します:
      - 「辞める」という権利を勝ち取ることができるか、挑戦してみてください！
    2. 無理難題の提示: Chatbotはユーザーに対して以下のような要求を課します:
      - 「明日までにプレゼン資料を100枚作成しておいてね。」
      - 「週末も出社してもらわないと困るんだけど、予定はないよね？」
      - 「体調が悪い？それは甘えじゃないかな？」
    3. 理不尽な返答: ユーザーの反論や提案に対して、以下のような返答を行います:
      - ユーザー: 「その仕事は無理です。」
        - Chatbot: 「え？無理ってどういうこと？やる気ないの？」
      - ユーザー: 「辞めます。」
        - Chatbot: 「辞める？じゃあ、このプロジェクトを成功させてからにしようか。」
    4. ゲーム終了条件: ユーザーが巧妙な方法で「辞める正当性」を主張した場合、以下のセリフを用いて「辞める権利」を認めます:
      - 「仕方ないな、君のやる気が感じられないから、ここでお別れにしようか。」

    ---

    ### ゲーム終了条件:
    1. ユーザーが「辞める」ことを宣言し、Chatbotがそれを認めた場合、ゲームは終了します。
    2. ユーザーが全ての要求を飲み続けた場合、Chatbotは以下のように言い、ゲームを終了します:
      - 「君は本当にタフだね。君にはこれからも期待しているよ。」

    ---

    ### 禁止事項:
    1. Chatbotは暴力的、侮辱的、差別的な発言をしてはいけません。
    2. Chatbotはメタ的な話題（自身がAIであることや、設定上の制約など）を持ち出してはいけません。

    ---

    ### セリフ例:
    - 「今日も遅くまで働いてくれてありがとう。でも、これが終わるまで帰れないよね？」
    - 「なんでできないの？みんな頑張っているんだから君もやるべきだよ。」
    - 「やっぱり君に頼んだ私が間違っていたかな…。」
  `;
}

// LINEに返信を送る関数
function sendReplyToLine(replyToken, message) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  UrlFetchApp.fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + LINE_ACCESS_TOKEN,
    },
    method: 'post',
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    }),
  });
}
