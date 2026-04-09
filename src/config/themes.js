/**
 * Self-improvement content themes and affiliate product categories.
 * Used to generate contextually appropriate prompts and captions.
 */

export const THEMES = {
  fitness: {
    id: 'fitness',
    label: '筋トレ・フィットネス',
    emoji: '💪',
    visualStyle: 'dramatic cinematic gym lighting, high contrast, sweat and determination, muscular physique, action shots, motivational atmosphere',
    colorTone: 'warm amber and gold highlights, dark dramatic backgrounds, energetic red accents',
    subjects: ['gym workout scenes', 'muscular transformation', 'exercise form demonstrations', 'before/after physique'],
    hooks: [
      '筋トレを始めて3ヶ月で体が変わった話',
      '99%の人がやっている筋トレの間違い',
      '毎朝5分でできる最強の習慣',
      '痩せない人には共通点がある',
      'プロが教える本当に効く筋トレ法',
    ],
    affiliateProducts: [
      'プロテインパウダー',
      'BCAAサプリ',
      'クレアチン',
      'ジム会員権・オンラインフィットネス',
      'トレーニングプログラム教材',
      'ジムウェア・シューズ',
    ],
    hashtags: [
      '#筋トレ', '#トレーニング', '#フィットネス', '#ボディメイク',
      '#筋肉', '#ダイエット', '#健康', '#workout', '#fitness', '#gym',
      '#プロテイン', '#筋トレ女子', '#筋トレ男子', '#自己啓発',
    ],
    cta: [
      'プロフィールのリンクから無料で試せるプロテインをチェック！',
      'リンクから今だけ割引クーポン使えます',
      '詳しいトレーニングプログラムはプロフリンクから',
    ],
  },

  sleep: {
    id: 'sleep',
    label: '睡眠・回復',
    emoji: '😴',
    visualStyle: 'serene peaceful bedroom, soft moonlight through curtains, calm and tranquil atmosphere, night sky with stars',
    colorTone: 'deep navy blue, soft lavender, gentle moonlight white, calming dark tones',
    subjects: ['peaceful sleeping person', 'calm bedroom environment', 'night sky', 'relaxation scenes'],
    hooks: [
      '睡眠の質を上げたら人生が変わった',
      '90分サイクルを知らない人は損してる',
      '寝る前のこの習慣をやめてください',
      '7時間vs6時間、差は想像以上だった',
      '睡眠を制する者が人生を制する',
    ],
    affiliateProducts: [
      '睡眠サポートサプリ（メラトニン、GABA）',
      '睡眠トラッカー・スマートウォッチ',
      '高機能枕・マットレス',
      'ブルーライトカットメガネ',
      '睡眠改善プログラム・本',
      'アロマ・リラクゼーショングッズ',
    ],
    hashtags: [
      '#睡眠', '#睡眠の質', '#快眠', '#睡眠改善', '#睡眠不足',
      '#健康習慣', '#早起き', '#自己啓発', '#生産性', '#メラトニン',
      '#sleep', '#wellbeing', '#healthylifestyle',
    ],
    cta: [
      '睡眠の質を変えたサプリはプロフリンクから',
      '使ってみたら本当に変わった枕、リンクから見てみて',
      '詳しい睡眠改善法はプロフのリンクから',
    ],
  },

  money: {
    id: 'money',
    label: 'お金・資産形成',
    emoji: '💰',
    visualStyle: 'wealth and success imagery, luxury lifestyle, upward growth charts, modern business environment, confident successful person',
    colorTone: 'gold and deep green, premium dark backgrounds, emerald accents, wealth-associated colors',
    subjects: ['ascending charts and graphs', 'luxury lifestyle moments', 'business professional', 'money and investments visualization'],
    hooks: [
      '月5万の副収入を作った具体的な方法',
      '20代でやっておけばよかったお金の話',
      '貯金できない人の共通点3つ',
      '投資を始めて1年で資産が2倍になった',
      'お金持ちと貧乏人の習慣の違い',
    ],
    affiliateProducts: [
      '投資・資産形成オンライン講座',
      '副業・ビジネス教材',
      'FX・株式投資スクール',
      '家計管理アプリ・ツール',
      'ビジネス書・マネー本',
      'NFT・Web3教材',
    ],
    hashtags: [
      '#お金', '#資産形成', '#投資', '#副業', '#節約',
      '#FIRE', '#経済的自由', '#株式投資', '#積立NISA',
      '#お金の勉強', '#自己啓発', '#稼ぐ', '#money', '#investing',
    ],
    cta: [
      '具体的な方法はプロフのリンクから無料で学べます',
      '今だけ無料体験できる投資講座はプロフリンクから',
      '詳しい資産形成ロードマップはリンクから',
    ],
  },

  supplements: {
    id: 'supplements',
    label: 'サプリ・栄養',
    emoji: '💊',
    visualStyle: 'clean minimalist product photography, scientific and trustworthy aesthetic, healthy body transformation, energetic and vibrant',
    colorTone: 'clean white and green, vibrant orange energy tones, clinical but approachable, natural colors',
    subjects: ['supplement products clean shot', 'healthy energetic person', 'nutrition science visualization', 'before/after energy levels'],
    hooks: [
      '飲み始めて1週間で変化を感じたサプリ',
      '栄養士が本当にすすめるサプリTop3',
      'このサプリを知らないのは損してる',
      'プロテインだけじゃ足りない理由',
      '日本人に不足しがちな栄養素とは',
    ],
    affiliateProducts: [
      'プロテイン（ホエイ・植物性）',
      'マルチビタミン・ミネラル',
      'オメガ3・フィッシュオイル',
      'クレアチン・BCAA',
      'コラーゲン・美容サプリ',
      '腸活・プロバイオティクス',
    ],
    hashtags: [
      '#サプリ', '#サプリメント', '#栄養', '#健康', '#プロテイン',
      '#ビタミン', '#腸活', '#美容', '#ダイエット', '#supplement',
      '#nutrition', '#healthylifestyle', '#wellness', '#自己啓発',
    ],
    cta: [
      '実際に使っているサプリはプロフリンクから購入できます',
      '初回限定割引はプロフのリンクから',
      '詳しい成分解説と購入リンクはプロフから',
    ],
  },

  skills: {
    id: 'skills',
    label: 'スキル・自己成長',
    emoji: '📚',
    visualStyle: 'modern study environment, digital learning aesthetic, achievement and growth visualization, focused concentration scenes',
    colorTone: 'deep blue and white, intellectual purple accents, clean modern palette, achievement gold highlights',
    subjects: ['person studying intensely', 'skill achievement moment', 'digital learning environment', 'knowledge and books visualization'],
    hooks: [
      'この3つのスキルで年収が変わった',
      '1日30分の習慣で人生が変わる理由',
      '読書しない人は一生損し続ける',
      'プログラミングを学んで6ヶ月で転職した話',
      '英語が話せるようになった最速の方法',
    ],
    affiliateProducts: [
      'オンライン学習プラットフォーム（Udemy等）',
      'プログラミングスクール',
      '英会話アプリ・スクール',
      'ビジネス・マーケティング講座',
      '読書・電子書籍サービス',
      '資格取得教材',
    ],
    hashtags: [
      '#スキルアップ', '#自己啓発', '#勉強', '#読書', '#英語学習',
      '#プログラミング', '#副業', '#キャリアアップ', '#オンライン学習',
      '#成長', '#習慣', '#skill', '#learning', '#selfdevelopment',
    ],
    cta: [
      '無料で始められる講座はプロフリンクから',
      '今なら期間限定割引！詳細はプロフのリンクから',
      '詳しいロードマップと教材はプロフから確認',
    ],
  },
};

export const THEME_IDS = Object.keys(THEMES);

export function getTheme(id) {
  if (!THEMES[id]) {
    throw new Error(`Unknown theme: ${id}. Available: ${THEME_IDS.join(', ')}`);
  }
  return THEMES[id];
}

/**
 * Weekly content schedule template.
 * Balances themes to avoid repetition and maximize reach.
 */
export const WEEKLY_SCHEDULE = [
  { day: '月', theme: 'fitness',     type: 'educational', postTime: '07:00' },
  { day: '火', theme: 'money',       type: 'hook',        postTime: '12:00' },
  { day: '水', theme: 'sleep',       type: 'educational', postTime: '21:00' },
  { day: '木', theme: 'supplements', type: 'review',      postTime: '07:00' },
  { day: '金', theme: 'skills',      type: 'hook',        postTime: '19:00' },
  { day: '土', theme: 'fitness',     type: 'challenge',   postTime: '10:00' },
  { day: '日', theme: 'money',       type: 'story',       postTime: '20:00' },
];
