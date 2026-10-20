/**
 * サイト・SNSアカウントの内容からジャンルを判定し、合うアフィリエイト案件の種類を提案する（純粋ロジック）。
 * 報酬額・承認率などの条件は一切断定しない。提案は「案件の種類」「探すASP」「訴求の切り口」まで。
 */

export type Platform = "website" | "instagram" | "x" | "youtube" | "tiktok" | "note" | "unknown";

export type GenreDef = {
  id: string;
  label: string;
  /** 出現すると強い根拠になる語（重み2） */
  strong: string[];
  /** 補助的な語（重み1） */
  weak: string[];
  /** 合う案件の種類（成果条件のタイプ付き） */
  offerTypes: { name: string; action: string; note?: string }[];
  /** 主に取り扱いがあるASP（登録・検索の起点。実際の有無はASPで確認） */
  asps: string[];
  /** 訴求の切り口 */
  angles: string[];
  /** 注意点（法規制・審査など） */
  cautions?: string[];
};

export const GENRES: GenreDef[] = [
  { id: "career", label: "転職・キャリア", strong: ["転職", "退職", "面接", "履歴書", "職務経歴書", "転職エージェント", "キャリア", "第二新卒", "内定"], weak: ["年収", "求人", "仕事", "上司", "残業", "ブラック企業", "ホワイト", "働き方"],
    offerTypes: [{ name: "転職エージェント（無料面談予約）", action: "無料登録・面談" }, { name: "転職サイト（会員登録）", action: "無料会員登録" }, { name: "退職代行", action: "申込" }, { name: "資格・スキル講座（転職向け）", action: "無料カウンセリング・資料請求" }],
    asps: ["A8.net", "afb（アフィb）", "バリューコマース", "アクセストレード"], angles: ["年代×職種で絞った体験談（例: 30代未経験から〇〇へ）", "エージェント比較は『担当の質』『求人の非公開数』など自分で確認できる軸で", "退職・転職の不安→解決の順に書く"], cautions: ["『必ず年収アップ』など断定表現はNG。実体験か公式情報に限る"] },
  { id: "finance", label: "お金・投資・クレカ", strong: ["投資", "nisa", "積立", "株", "fx", "仮想通貨", "ビットコイン", "クレジットカード", "クレカ", "証券", "ポイ活", "節約", "家計", "副業"], weak: ["ポイント", "還元", "資産", "貯金", "口座", "利回り", "配当", "iDeCo", "ideco", "ローン"],
    offerTypes: [{ name: "証券口座開設", action: "口座開設（本人確認完了まで）" }, { name: "クレジットカード発行", action: "カード発行" }, { name: "FX・暗号資産口座", action: "口座開設＋取引" }, { name: "家計簿・ポイ活アプリ", action: "アプリ登録" }],
    asps: ["A8.net", "アクセストレード", "afb（アフィb）", "バリューコマース", "もしもアフィリエイト"], angles: ["『初心者が最初の1口座を開くまで』の手順記事", "ポイント還元は公式の数字だけを引用", "リスクと手数料を正直に書くと承認率と信頼が上がる"], cautions: ["金融商品は景品表示法・金融商品取引法の表現規制あり。『確実に儲かる』は不可。案件ごとのNG表現を必ず確認"] },
  { id: "beauty", label: "美容・コスメ・スキンケア", strong: ["コスメ", "スキンケア", "化粧品", "美容液", "美白", "毛穴", "ファンデ", "リップ", "メイク", "シャンプー", "ヘアケア", "美容"], weak: ["保湿", "肌", "乾燥", "ニキビ", "プチプラ", "デパコス", "成分", "レビュー", "韓国"],
    offerTypes: [{ name: "化粧品・スキンケア定期（初回）", action: "初回購入（定期）" }, { name: "美容サプリ・インナーケア", action: "購入" }, { name: "美容クリニック・脱毛（カウンセリング）", action: "無料カウンセリング来店" }, { name: "コスメECモール", action: "購入" }],
    asps: ["afb（アフィb）", "A8.net", "もしもアフィリエイト", "楽天アフィリエイト", "Amazonアソシエイト"], angles: ["肌質・年代を明記したビフォーアフターではなく『使用感』中心", "定期縛り・解約条件を先に書くと否認が減る", "成分の説明は公式サイトの記載範囲で"], cautions: ["薬機法: 『シミが消える』『治る』など効能の断定は不可。『個人の感想』でも誇大表現は不可"] },
  { id: "fitness", label: "ダイエット・筋トレ・フィットネス", strong: ["ダイエット", "筋トレ", "宅トレ", "トレーニング", "ジム", "プロテイン", "痩せ", "体脂肪", "糖質", "ヨガ", "ピラティス"], weak: ["体重", "食事", "カロリー", "腹筋", "ランニング", "ストレッチ", "姿勢", "健康"],
    offerTypes: [{ name: "パーソナルジム（無料カウンセリング）", action: "無料カウンセリング来店" }, { name: "オンラインフィットネス・ヨガ", action: "無料体験・有料登録" }, { name: "プロテイン・サプリ（定期）", action: "初回購入" }, { name: "宅食・置き換え食", action: "購入" }],
    asps: ["A8.net", "afb（アフィb）", "もしもアフィリエイト", "Amazonアソシエイト"], angles: ["『〇日続けた記録』など継続のリアルが刺さる", "ジム比較は料金体系・解約条件を自分で確認して書く", "自宅派/ジム派で読者を分ける"], cautions: ["『〇kg痩せる』の断定は不可。体験は『個人の結果』と明記"] },
  { id: "health", label: "健康・サプリ・睡眠", strong: ["サプリ", "睡眠", "不眠", "腸活", "乳酸菌", "疲労", "免疫", "血糖", "血圧", "整体", "マッサージ"], weak: ["健康", "栄養", "ビタミン", "体調", "ストレス", "肩こり", "腰痛", "目の疲れ"],
    offerTypes: [{ name: "健康食品・サプリ（定期初回）", action: "初回購入" }, { name: "マットレス・寝具", action: "購入" }, { name: "オンライン診療・検査キット", action: "申込" }],
    asps: ["afb（アフィb）", "A8.net", "もしもアフィリエイト", "楽天アフィリエイト"], angles: ["悩み（眠れない等）→試したこと→変化の順", "成分や機能性表示は公式記載の範囲で引用"], cautions: ["薬機法・健康増進法: 病気が治る、予防できる等の表現は不可"] },
  { id: "english", label: "英語・語学学習", strong: ["英語", "toeic", "英会話", "オンライン英会話", "留学", "英検", "toefl", "ielts", "単語", "リスニング"], weak: ["勉強", "学習", "教材", "スピーキング", "発音", "海外", "外国人"],
    offerTypes: [{ name: "オンライン英会話（無料体験）", action: "無料体験レッスン" }, { name: "英語コーチング（無料カウンセリング）", action: "無料カウンセリング" }, { name: "英語学習アプリ", action: "有料登録" }, { name: "留学エージェント", action: "資料請求・相談" }],
    asps: ["A8.net", "afb（アフィb）", "バリューコマース", "アクセストレード"], angles: ["スコアの推移を記録として見せる（数字は自分の実績のみ）", "『無料体験の流れ』を画像付きで", "目的別（TOEIC/会話/留学）で比較"] },
  { id: "programming", label: "プログラミング・ITスキル", strong: ["プログラミング", "エンジニア", "python", "javascript", "react", "コード", "web制作", "スクール", "未経験", "webデザイン", "ai", "chatgpt"], weak: ["学習", "転職", "ポートフォリオ", "フリーランス", "開発", "アプリ", "ツール", "効率化"],
    offerTypes: [{ name: "プログラミングスクール（無料カウンセリング）", action: "無料カウンセリング・説明会" }, { name: "動画学習サービス", action: "有料登録" }, { name: "レンタルサーバー・ドメイン", action: "契約" }, { name: "AIツール・SaaS", action: "有料登録" }],
    asps: ["A8.net", "afb（アフィb）", "バリューコマース", "もしもアフィリエイト"], angles: ["学習ロードマップ記事に『この段階で使った教材』として自然に置く", "サーバー・ツールは『自分の設定手順』が最強の記事", "スクールは料金・期間・転職保証の条件を公式で確認して比較"] },
  { id: "parenting", label: "子育て・教育・妊娠出産", strong: ["子育て", "育児", "妊娠", "出産", "赤ちゃん", "ベビー", "幼児", "小学生", "通信教育", "知育", "保育園", "ママ", "パパ"], weak: ["子ども", "子供", "離乳食", "おむつ", "習い事", "受験", "教材", "絵本", "家族"],
    offerTypes: [{ name: "通信教育・タブレット学習（資料請求/入会）", action: "資料請求・入会" }, { name: "ベビー用品・サブスク", action: "購入・登録" }, { name: "家事代行・宅食", action: "初回利用" }, { name: "学資保険・保険相談", action: "無料相談" }],
    asps: ["A8.net", "afb（アフィb）", "バリームコマース".replace("ム", "ュー"), "もしもアフィリエイト", "Amazonアソシエイト"], angles: ["月齢・学年ごとの悩みに対応した記事", "資料請求系は『届いた中身』を見せる", "時短・家事負担の軽減は共感を得やすい"] },
  { id: "gadget", label: "ガジェット・家電・PC", strong: ["ガジェット", "家電", "iphone", "android", "イヤホン", "ヘッドホン", "モニター", "キーボード", "マウス", "pc", "パソコン", "スマホ", "カメラ", "ロボット掃除機"], weak: ["レビュー", "開封", "比較", "おすすめ", "コスパ", "スペック", "便利", "usb"],
    offerTypes: [{ name: "Amazon・楽天などの物販（商品リンク）", action: "購入" }, { name: "家電量販店EC", action: "購入" }, { name: "格安SIM・光回線", action: "契約" }, { name: "サブスク（音楽・動画）", action: "有料登録" }],
    asps: ["Amazonアソシエイト", "楽天アフィリエイト", "もしもアフィリエイト", "バリューコマース", "A8.net"], angles: ["『買って失敗した点』を入れると信頼される", "比較表＋用途別おすすめ", "セール時期の記事はクリックが伸びる"] },
  { id: "telecom", label: "通信・光回線・格安SIM", strong: ["光回線", "格安sim", "sim", "wifi", "wi-fi", "ポケットwifi", "回線", "ギガ", "通信費", "mvno", "乗り換え", "mnp"], weak: ["スマホ", "料金", "速度", "契約", "解約", "キャンペーン", "節約"],
    offerTypes: [{ name: "光回線（申込＋開通）", action: "申込・開通" }, { name: "格安SIM（MNP契約）", action: "契約" }, { name: "ホームルーター・ポケットWi-Fi", action: "契約" }],
    asps: ["A8.net", "アクセストレード", "afb（アフィb）", "バリューコマース"], angles: ["『今の契約から乗り換えてこう変わった』の実例", "料金は公式の最新表記を日付付きで引用", "解約金・縛りを先に書く"], cautions: ["キャンペーン条件は変わりやすい。更新日を明記"] },
  { id: "travel", label: "旅行・ホテル・おでかけ", strong: ["旅行", "ホテル", "温泉", "観光", "宿", "飛行機", "航空券", "旅", "海外旅行", "国内旅行", "キャンプ"], weak: ["予約", "おすすめ", "グルメ", "絶景", "週末", "レンタカー", "マイル", "格安"],
    offerTypes: [{ name: "宿泊予約サイト", action: "予約・宿泊完了" }, { name: "航空券・ツアー予約", action: "予約" }, { name: "レンタカー・アクティビティ予約", action: "予約" }, { name: "旅行向けクレジットカード", action: "カード発行" }],
    asps: ["バリューコマース", "A8.net", "楽天アフィリエイト", "もしもアフィリエイト"], angles: ["モデルコース＋そのまま予約できる導線", "『このホテルを選んだ理由』を写真付きで", "旅費内訳の公開はクリックされやすい"] },
  { id: "housing", label: "引越し・不動産・暮らし", strong: ["引越し", "引っ越し", "賃貸", "不動産", "マイホーム", "住宅ローン", "リフォーム", "一人暮らし", "物件", "間取り"], weak: ["家賃", "新生活", "収納", "インテリア", "家具", "掃除", "暮らし"],
    offerTypes: [{ name: "引越し一括見積もり", action: "見積もり依頼" }, { name: "不動産査定・売却相談", action: "査定依頼" }, { name: "家具・インテリアEC", action: "購入" }, { name: "ハウスクリーニング・不用品回収", action: "申込" }],
    asps: ["A8.net", "アクセストレード", "afb（アフィb）", "楽天アフィリエイト"], angles: ["引越し準備チェックリスト記事に見積もり導線", "一人暮らし初期費用の内訳"] },
  { id: "dating", label: "恋愛・婚活・マッチング", strong: ["婚活", "マッチングアプリ", "恋愛", "出会い", "結婚相談所", "デート", "彼氏", "彼女", "結婚"], weak: ["アプリ", "プロフィール", "メッセージ", "モテ", "独身", "30代", "40代"],
    offerTypes: [{ name: "マッチングアプリ（登録）", action: "無料登録・有料会員" }, { name: "結婚相談所（無料相談）", action: "無料カウンセリング" }, { name: "婚活パーティー予約", action: "参加申込" }],
    asps: ["A8.net", "afb（アフィb）", "アクセストレード"], angles: ["年代・目的別アプリ比較（自分で使った範囲で）", "プロフィール文の作り方など実用記事に導線"], cautions: ["出会い系規制・年齢確認の案内。未成年向け表現は不可"] },
  { id: "vod", label: "動画配信・サブスク・エンタメ", strong: ["vod", "動画配信", "アニメ", "ドラマ", "映画", "見放題", "netflix", "u-next", "hulu", "amazon prime", "配信", "見逃し"], weak: ["おすすめ", "ランキング", "感想", "ネタバレ", "声優", "漫画", "無料トライアル"],
    offerTypes: [{ name: "動画配信サービス（無料トライアル登録）", action: "無料体験登録" }, { name: "電子書籍・漫画サービス", action: "会員登録・購入" }, { name: "音楽配信", action: "有料登録" }],
    asps: ["A8.net", "afb（アフィb）", "バリューコマース", "もしもアフィリエイト", "Amazonアソシエイト"], angles: ["作品名で検索される記事に『どこで見られるか』を添える", "配信状況は変わるので更新日を明記"], cautions: ["配信有無・無料期間は公式で確認。ネタバレ・画像転載に注意"] },
  { id: "game", label: "ゲーム・ホビー", strong: ["ゲーム", "switch", "ps5", "steam", "ゲーミング", "攻略", "スマホゲーム", "ガチャ", "プラモ", "フィギュア", "ボードゲーム"], weak: ["レビュー", "配信", "実況", "周辺機器", "コントローラー", "ヘッドセット", "モニター"],
    offerTypes: [{ name: "ゲーミングPC・周辺機器（物販）", action: "購入" }, { name: "ゲームアプリ（インストール・条件達成）", action: "インストール＋到達" }, { name: "ゲーム買取・中古", action: "買取申込" }],
    asps: ["Amazonアソシエイト", "楽天アフィリエイト", "A8.net", "もしもアフィリエイト"], angles: ["『このプレイ環境で使っている機材』紹介", "初心者向けの機材選び"] },
  { id: "pet", label: "ペット", strong: ["犬", "猫", "ペット", "ドッグフード", "キャットフード", "わんちゃん", "ねこ", "子犬", "子猫", "トリミング"], weak: ["フード", "おやつ", "しつけ", "動物病院", "保険", "散歩", "トイレ"],
    offerTypes: [{ name: "プレミアムペットフード（定期初回）", action: "初回購入" }, { name: "ペット保険（資料請求・申込）", action: "資料請求・申込" }, { name: "ペット用品EC", action: "購入" }],
    asps: ["A8.net", "afb（アフィb）", "もしもアフィリエイト", "Amazonアソシエイト"], angles: ["うちの子の食いつき・便の変化など具体的な観察", "保険は補償内容を公式で確認して比較"] },
  { id: "car", label: "車・バイク", strong: ["車", "クルマ", "バイク", "中古車", "車検", "査定", "買取", "カーリース", "ドライブ", "タイヤ"], weak: ["燃費", "保険", "洗車", "ナビ", "ドラレコ", "納車", "ローン"],
    offerTypes: [{ name: "車・バイク一括査定", action: "査定申込" }, { name: "カーリース（申込）", action: "申込・審査通過" }, { name: "自動車保険一括見積もり", action: "見積もり" }, { name: "カー用品EC", action: "購入" }],
    asps: ["A8.net", "アクセストレード", "afb（アフィb）", "楽天アフィリエイト"], angles: ["売却体験（査定額の推移は自分の実績のみ）", "維持費の内訳記事"] },
  { id: "insurance", label: "保険・相談サービス", strong: ["保険", "生命保険", "医療保険", "保険相談", "fp", "ファイナンシャルプランナー", "見直し"], weak: ["保障", "掛け捨て", "加入", "老後", "年金", "相続"],
    offerTypes: [{ name: "保険の無料相談（面談完了）", action: "無料相談の面談完了" }, { name: "保険一括見積もり", action: "見積もり" }],
    asps: ["A8.net", "アクセストレード", "afb（アフィb）"], angles: ["ライフイベント（結婚・出産・住宅購入）ごとの見直し記事"], cautions: ["保険の比較・募集表現は規制あり。特定商品の断定的推奨は避ける"] },
  { id: "food", label: "料理・宅食・グルメ", strong: ["レシピ", "料理", "宅食", "ミールキット", "お取り寄せ", "グルメ", "弁当", "時短料理", "ふるさと納税", "食材宅配"], weak: ["簡単", "作り置き", "節約", "美味しい", "食べ", "スイーツ", "コーヒー"],
    offerTypes: [{ name: "食材宅配・ミールキット（初回お試し）", action: "お試しセット購入" }, { name: "冷凍宅食（初回購入）", action: "初回購入" }, { name: "ふるさと納税サイト", action: "寄付（購入）" }, { name: "お取り寄せEC", action: "購入" }],
    asps: ["A8.net", "afb（アフィb）", "楽天アフィリエイト", "バリューコマース", "もしもアフィリエイト"], angles: ["お試しセットの中身を写真で全部見せる", "1食あたりの価格は公式の数字を日付付きで"] },
  { id: "fashion", label: "ファッション・服", strong: ["ファッション", "コーデ", "服", "靴", "スニーカー", "バッグ", "アクセサリー", "ユニクロ", "gu", "古着", "着回し"], weak: ["おしゃれ", "季節", "トレンド", "体型", "サイズ", "プチプラ", "ブランド"],
    offerTypes: [{ name: "ファッションEC（購入）", action: "購入" }, { name: "服のサブスク・レンタル", action: "登録" }, { name: "ブランド買取", action: "買取申込" }],
    asps: ["楽天アフィリエイト", "Amazonアソシエイト", "バリューコマース", "A8.net", "もしもアフィリエイト"], angles: ["着用写真＋サイズ感（身長・体型）", "シーン別コーデに商品リンク"] },
  { id: "books", label: "本・漫画・学び", strong: ["書評", "読書", "本", "漫画", "マンガ", "電子書籍", "kindle", "オーディオブック", "audible", "小説"], weak: ["おすすめ", "要約", "感想", "名作", "学び", "自己啓発"],
    offerTypes: [{ name: "電子書籍サービス（会員登録・購入）", action: "登録・購入" }, { name: "オーディオブック（無料体験）", action: "無料体験登録" }, { name: "書籍の物販リンク", action: "購入" }],
    asps: ["Amazonアソシエイト", "楽天アフィリエイト", "A8.net", "バリューコマース"], angles: ["要約・書評の末尾に『どこで読めるか』", "ジャンル別まとめ"] },
  { id: "smallbiz", label: "副業・ブログ運営・ビジネス", strong: ["ブログ", "アフィリエイト", "副業", "seo", "wordpress", "フリーランス", "起業", "マーケティング", "sns運用", "物販", "せどり"], weak: ["収益", "稼ぐ", "集客", "ツール", "テンプレート", "サーバー", "ドメイン", "デザイン"],
    offerTypes: [{ name: "レンタルサーバー（契約）", action: "契約" }, { name: "WordPressテーマ・ツール", action: "購入" }, { name: "ASP自己アフィリエイト・会員登録", action: "会員登録" }, { name: "クラウドソーシング・スキル販売", action: "登録" }],
    asps: ["A8.net", "もしもアフィリエイト", "バリューコマース", "afb（アフィb）"], angles: ["『自分の作業手順』をそのまま記事に", "収益報告は実数のみ、再現性の断定はしない"], cautions: ["『誰でも稼げる』等は不可。実績は自分の数字だけ"] },
  { id: "lifestyle", label: "暮らし・ライフスタイル全般", strong: ["暮らし", "ライフスタイル", "日常", "丁寧な暮らし", "ミニマリスト", "家事", "掃除", "収納"], weak: ["便利", "おすすめ", "買ってよかった", "愛用", "習慣", "朝活"],
    offerTypes: [{ name: "日用品・生活家電（物販）", action: "購入" }, { name: "家事代行・クリーニング", action: "初回利用" }, { name: "サブスク（日用品・コーヒーなど）", action: "登録" }],
    asps: ["Amazonアソシエイト", "楽天アフィリエイト", "もしもアフィリエイト", "A8.net"], angles: ["『買ってよかったものまとめ』は定番で強い", "使用シーンの写真"] },
];

/** 既存アフィリエイトリンクの検出（ドメイン → ASP名） */
const AFF_DOMAINS: [RegExp, string][] = [
  [/px\.a8\.net|a8\.net/i, "A8.net"], [/af\.moshimo\.com|moshimo\.com/i, "もしもアフィリエイト"], [/afi-b\.com|t\.afi-b\.com/i, "afb（アフィb）"],
  [/valuecommerce\.com|ck\.jp\.ap\.valuecommerce/i, "バリューコマース"], [/amazon\.co\.jp.*tag=|amzn\.to|amzn\.asia/i, "Amazonアソシエイト"], [/hb\.afl\.rakuten\.co\.jp|a\.r10\.to/i, "楽天アフィリエイト"],
  [/h\.accesstrade\.net|accesstrade\.net/i, "アクセストレード"], [/linksynergy\.com|rakuten\.co\.jp\/link/i, "楽天（LinkShare）"], [/felmat\.net/i, "felmat"], [/rentracks\.jp/i, "レントラックス"],
];

export function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (/instagram\.com/.test(u)) return "instagram";
  if (/(^|\/\/)(www\.)?(x\.com|twitter\.com)/.test(u)) return "x";
  if (/youtube\.com|youtu\.be/.test(u)) return "youtube";
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/note\.com/.test(u)) return "note";
  if (/^https?:\/\//.test(u)) return "website";
  return "unknown";
}

export const PLATFORM_LABEL: Record<Platform, string> = { website: "Webサイト・ブログ", instagram: "Instagram", x: "X（旧Twitter）", youtube: "YouTube", tiktok: "TikTok", note: "note", unknown: "不明" };

export type Extracted = { title: string; description: string; headings: string[]; body: string; links: string[] };

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** HTMLからタイトル・説明・見出し・本文・リンクを抜き出す（依存ライブラリなし） */
export function extractFromHtml(html: string): Extracted {
  const h = html.slice(0, 1_500_000);
  const meta = (name: string) => {
    const m = h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i")) ?? h.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i"));
    return m ? decode(m[1]).trim() : "";
  };
  const title = strip(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || meta("og:title");
  const description = meta("description") || meta("og:description") || meta("twitter:description");
  const headings = Array.from(h.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((m) => strip(m[1])).filter(Boolean).slice(0, 60);
  const links = Array.from(h.matchAll(/href=["']([^"']+)["']/gi)).map((m) => m[1]).slice(0, 2000);
  const bodyHtml = h.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ");
  const body = strip(bodyHtml).slice(0, 30_000);
  return { title, description, headings, body, links };
}

export function detectAffiliateLinks(links: string[]): string[] {
  const found = new Set<string>();
  for (const l of links) for (const [re, name] of AFF_DOMAINS) if (re.test(l)) found.add(name);
  return [...found];
}

export type GenreScore = { id: string; label: string; score: number; share: number; hits: string[] };

/** ジャンル判定。タイトル・説明は重く、本文は出現回数（上限あり）で加点する */
export function classify(input: { title?: string; description?: string; headings?: string[]; body?: string }): GenreScore[] {
  const title = (input.title ?? "").toLowerCase(), desc = (input.description ?? "").toLowerCase();
  const heads = (input.headings ?? []).join(" ").toLowerCase(), body = (input.body ?? "").toLowerCase();
  const count = (text: string, kw: string) => { if (!kw || !text) return 0; let n = 0, i = 0; const k = kw.toLowerCase(); while ((i = text.indexOf(k, i)) !== -1) { n++; i += k.length; if (n >= 30) break; } return n; };
  const scored = GENRES.map((g) => {
    let score = 0; const hits = new Set<string>();
    for (const [kws, w] of [[g.strong, 2], [g.weak, 1]] as [string[], number][]) {
      for (const kw of kws) {
        const t = count(title, kw), d = count(desc, kw), hd = count(heads, kw), b = count(body, kw);
        const s = w * (t * 6 + d * 4 + Math.min(hd, 10) * 2 + Math.min(b, 30) * 0.5);
        if (s > 0) { score += s; hits.add(kw); }
      }
    }
    return { id: g.id, label: g.label, score, hits: [...hits].slice(0, 8) };
  }).filter((g) => g.score > 0).sort((a, b) => b.score - a.score);
  const total = scored.reduce((a, g) => a + g.score, 0) || 1;
  return scored.map((g) => ({ ...g, share: g.score / total }));
}

export type Recommendation = {
  platform: Platform;
  title: string;
  genres: GenreScore[];
  confidence: "high" | "medium" | "low";
  existingAsps: string[];
  picks: { genre: string; label: string; offerTypes: GenreDef["offerTypes"]; asps: string[]; angles: string[]; cautions: string[] }[];
  /** ユーザーが登録済みの案件のうち、判定ジャンルに合うもの */
  matchedOffers: { id: string; name: string; genre: string }[];
  notes: string[];
};

export function recommend(ex: Extracted, platform: Platform, userOffers: { id: string; name: string; category: string; targetAudience?: string }[] = []): Recommendation {
  const genres = classify(ex);
  const top = genres.filter((g, i) => i === 0 || g.share >= 0.12).slice(0, 3);
  const textLen = ex.body.length + ex.description.length + ex.title.length;
  const confidence: Recommendation["confidence"] = !top.length ? "low" : top[0].share >= 0.45 && textLen > 800 ? "high" : top[0].share >= 0.3 && textLen > 300 ? "medium" : "low";
  const picks = top.map((g) => { const d = GENRES.find((x) => x.id === g.id)!; return { genre: g.id, label: d.label, offerTypes: d.offerTypes, asps: d.asps, angles: d.angles, cautions: d.cautions ?? [] }; });
  const matchedOffers = userOffers.flatMap((o) => {
    const c = classify({ title: o.name, description: `${o.category} ${o.targetAudience ?? ""}` });
    const hit = c.find((x) => top.some((t) => t.id === x.id));
    return hit ? [{ id: o.id, name: o.name, genre: hit.label }] : [];
  });
  const notes: string[] = [];
  if (textLen < 300) notes.push("読み取れた文章が少ないため精度が下がっています。プロフィール文や投稿本文を貼り付けると改善します。");
  if (platform === "instagram" || platform === "x" || platform === "tiktok") notes.push(`${PLATFORM_LABEL[platform]}は外部から取得できる情報が限られます（プロフィール文程度）。投稿のキャプションを数件貼り付けるのがおすすめです。`);
  if (!top.length) notes.push("ジャンルを特定できませんでした。サイトの主なテーマを表す文章を貼り付けてください。");
  return { platform, title: ex.title, genres: genres.slice(0, 6), confidence, existingAsps: detectAffiliateLinks(ex.links), picks, matchedOffers, notes };
}

/** 貼り付けテキストだけから推定するときの入力変換 */
export function extractedFromText(text: string, title = ""): Extracted {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { title: title || lines[0]?.slice(0, 80) || "", description: lines.slice(1, 3).join(" "), headings: lines.filter((l) => l.length <= 40).slice(0, 30), body: text.slice(0, 30_000), links: Array.from(text.matchAll(/https?:\/\/\S+/g)).map((m) => m[0]) };
}
