/** 公開前チェック（純粋関数。クライアント側でも使う） */

/** 広告表示（PR表記）が入っているか */
export function hasAdDisclosure(text: string): boolean {
  return /(^|[\s【［\[（(#＃])(PR|ＰＲ|広告|プロモーション|アフィリエイト広告)/m.test(text) || /#PR\b|#広告/.test(text);
}

const RISKY: [RegExp, string][] = [
  [/必ず(儲|稼|痩|治|効)|絶対(に)?(儲|稼|痩|治|効)/, "「必ず」「絶対」など結果を断定する表現"],
  [/(治る|治ります|完治|病気が良くなる)/, "病気が治るという表現（薬機法）"],
  [/(痩せ(る|ます)|脂肪(が|を)燃焼|若返)/, "痩せる・若返るなど身体への効果の断定（薬機法の可能性）"],
  [/(No\.?\s?1|ナンバーワン|業界初|日本一|最安|最高品質)/i, "No.1・最安・業界初など根拠が必要な表現"],
  [/(元本保証|損しない|ノーリスク|確実に儲)/, "損をしない・確実に儲かるなど金融の誇大表現"],
  [/(誰でも簡単に月\d+万|放置で稼)/, "誰でも簡単に稼げる等の誇大表現"],
  [/(私も使って|実際に使って|愛用して|使ってみた)/, "体験談の表現（実際に使った場合のみ。使っていなければ削除）"],
];

/** 公開前チェック：広告表示の有無と、注意が必要な表現を洗い出す */
export function lintContent(text: string): { adDisclosure: boolean; issues: string[] } {
  const issues = RISKY.filter(([re]) => re.test(text)).map(([, msg]) => msg);
  return { adDisclosure: hasAdDisclosure(text), issues };
}
