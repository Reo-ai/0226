# Episode #01 ── 動画生成プロンプト完全版
## 喋りパート（非DAWシーン）全5シーン
## TikTok/Reels 縦動画（9:16）Pixar風3Dアニメ

---

## 共通設定（全シーン共通）

```
【スタイル定義】
- Pixar / Illumination 風 3D CG アニメーション
- 参考作品: Pixar「ソウル」「マイ・エレメント」
- 解像度: 1080 × 1920 (9:16 縦)
- フレームレート: 30fps
- 照明: ソフト3点ライト（暖色キー + 柔らかフィル + リムライト）
- レンダリング: 高品質サブサーフェス・スキャッタリング
- 目の表現: 大きく輝くPixarスタイル（ハイライト2点）

【作曲先生 固定ビジュアル】
female music teacher, early 30s, short wavy light brown bob hair,
round thin-framed glasses, bright green cardigan, white blouse,
patterned silk scarf, holding a conductor's baton or pencil,
warm friendly face, expressive large brown eyes

【作曲ネコ 固定ビジュアル】
chubby black anthropomorphic cat, standing upright, round cute face,
large light blue over-ear headphones, navy blue hoodie with gold star,
sleepy half-lidded green eyes, fluffy long tail, holding a pencil
```

---

## SCENE A ── フック [0〜3秒]
### 「なんかメロディが地味ニャ…」

---

### ▶ Runway Gen-3 Alpha

**推奨クリップ数：** 1本（3秒）  
**モード：** Text-to-Video

```
PROMPT:
Pixar-style 3D animated short, vertical 9:16 format,
chubby black anthropomorphic cat character,
navy blue hoodie with gold star on chest,
large light blue headphones slightly askew on head,
half-lidded sleepy green eyes looking troubled,
sitting at a tiny music keyboard, slouched posture,
both paws pressed against cheeks in a worried gesture,
fluffy tail drooping down sadly,
three small question marks (???) floating and spinning above head,
musical notes floating around looking chaotic and wrong,
soft pastel blue-lavender gradient studio background,
warm rim lighting outlining the character,
subtle breathing animation, slight body sway,
camera slowly pushes in from medium shot to close-up bust shot,
Pixar "Soul" render quality, expressive emotional animation,
3 seconds, cinematic depth of field

MOTION: slow push-in zoom, subtle idle breathing, tail sway
CAMERA: starts medium full body → ends bust close-up
MOOD: confused, troubled, relatable
```

**Negative prompt:**
```
realistic, photorealistic, harsh lighting, sharp edges,
adult content, scary, dark horror, text in image
```

---

### ▶ Kling AI（日本語対応）

```
【映像プロンプト】
Pixarスタイルの3Dアニメ、縦9:16、
ネイビーブルーのパーカーを着た丸くてかわいい黒猫キャラクター、
ライトブルーのヘッドフォンをつけて、
両手を頬に当てて困った表情で小さなキーボードの前に座っている、
頭上に「？？？」マークが3つ浮かんでいる、
パステルブルーのシンプルな背景、暖かいライティング、
カメラがゆっくり寄っていく、3秒

【動きの指示】
身体が微妙に揺れる、しっぽがしょんぼり垂れている、瞬き1回
```

---

### ▶ Pika Labs

```
A Pixar-style 3D animated chubby black cat in navy hoodie,
wearing large blue headphones, sitting at mini keyboard,
looking confused and worried with paws on cheeks,
question marks floating above, pastel blue background,
camera slowly zooms in, soft warm lighting, 3 seconds
```

---

### テロップオーバーレイ仕様

```
フォント: Noto Sans JP ExtraBold
テキスト1: 「なんか地味なメロディ…」
  サイズ: 52px / 色: 白 / 縁取り: 黒 3px
  位置: 上部 15% / アニメ: ポップイン（0.1秒）

テキスト2: 「原因はコレです」
  サイズ: 64px / 色: 黄色 #FFD700 / 縁取り: 黒 3px
  位置: 中央 / アニメ: 0.5秒後にポップイン
  エフェクト: 軽い揺れ（wiggle）
```

---

## SCENE B-WIPE ── Before ワイプ [3〜8秒]
### 先生の共感リアクション（右下小窓）

---

### ▶ Runway Gen-3 Alpha

```
PROMPT:
Pixar-style 3D animated bust shot, vertical crop,
female music teacher, short wavy light brown hair, round glasses,
bright green cardigan, gentle empathetic expression,
slowly nodding head in understanding,
eyebrows slightly raised in recognition,
soft warm smile growing as she listens,
clean neutral warm-beige background (for chroma key overlay),
soft three-point studio lighting, Pixar render quality,
5 seconds loop-able, subtle breathing animation

MOTION: gentle nodding (2 nods), slight head tilt to left, warm smile forming
CAMERA: static bust shot, slight rack focus
MOOD: empathetic, understanding, "I know that feeling"

SIZE NOTE: This will be used as small PIP overlay (bottom-right corner)
           Ensure face fills upper 2/3 of frame
```

**Green screen版（合成用）:**
```
[上記プロンプト] + 
"pure green background #00FF00, chroma key ready,
character isolated, no background objects"
```

---

### ▶ Kling AI

```
Pixarスタイル3Dアニメ、バストショット、
メガネをかけた明るいブラウンのボブヘアの女性先生、
グリーンのカーディガン、
共感した表情でゆっくりうなずいている、
温かい微笑み、グリーンバック背景、
5秒ループ、ソフトな照明
```

---

## SCENE C ── 解説パート [8〜18秒]
### 先生が3ポイントを解説（10秒 → 3クリップに分割）

---

### C-1「実はたった3つのことで変わるんです」[8〜11秒]

#### ▶ Runway Gen-3 Alpha

```
PROMPT:
Pixar-style 3D animated medium shot, 9:16 vertical,
enthusiastic female music teacher, light brown bob with glasses,
green cardigan, pointing index finger upward with big bright smile,
leaning slightly forward toward camera with energy,
eyebrows raised in excitement, eyes wide and sparkling,
musical notes and sparkle particles floating around her,
warm pastel studio background (soft gradient: cream to light mint),
three-point warm studio lighting with subtle rim light,
Pixar "Soul" animation quality, highly expressive,
3 seconds

MOTION: index finger raises from down to up (0.5s), 
        body leans forward slightly, enthusiastic head nod,
        sparkle particles burst outward at peak moment
CAMERA: starts medium full → slight push to bust shot
MOOD: excited reveal, "I have the answer!"
```

---

### C-2「①音域を広げる ②リズムを変える」[11〜15秒]

#### ▶ Runway Gen-3 Alpha

```
PROMPT:
Pixar-style 3D animated bust shot, 9:16 vertical,
female music teacher, green cardigan and glasses,
counting on fingers — first extending index finger (#1),
then adding middle finger (#2) while explaining,
clear articulate expression, confident teaching pose,
mouth moving as if speaking (lip sync ready),
left hand holding small baton or pencil,
warm cream-colored studio background,
soft key light from upper left, gentle fill light,
Pixar render quality, smooth fluid animation,
4 seconds

MOTION: count finger 1 up → pause → count finger 2 up,
        head tilts slightly with each point,
        baton gestures left-right for each item
CAMERA: static bust, slight tilt correction
MOOD: clear explanation, step-by-step teaching
```

---

### C-3「③最高音は1か所だけ！」[15〜18秒]

#### ▶ Runway Gen-3 Alpha

```
PROMPT:
Pixar-style 3D animated close-up bust shot, 9:16 vertical,
female music teacher, green cardigan and glasses,
raising ONE finger (#3) with strong emphasis,
expression shifts to "THIS is the most important" — 
slightly wider eyes, knowing smile, eyebrows raised,
pointing finger then taps temple (as if it's a key insight),
a small golden star ✨ sparkle effect near the finger tip,
warm studio background, dramatic but soft lighting,
Pixar "Coco" level expressiveness, 3 seconds

MOTION: single finger raised with punch (emphasis), 
        brief pause at peak for emphasis,
        gold sparkle at fingertip,
        slow exhale-nod after the point
CAMERA: slightly lower angle (looking up slightly = authority)
MOOD: confident, "this is the key", satisfying revelation
```

---

### テロップ（Scene C 全体）

```
C-1テロップ:
  「ポイントは3つだけ」
  サイズ: 56px / 黄色 / 縁黒

C-2テロップ（順番に出現）:
  「① 音域を広げる（C4→B4）」→ 0.5秒後
  「② 8分音符を混ぜる」       → 1.5秒後
  各行: 白 / 縁黒 / 左揃え / スライドイン（左から）

C-3テロップ:
  「③ 最高音は」 → 通常
  「1か所だけ！」→ 黄色・大・ポップイン + 揺れエフェクト
  強調: テキスト周りに星マーク散布
```

---

## SCENE D-WIPE ── After ワイプ [18〜25秒]
### ネコのリアクション（右下小窓）

---

### ▶ Runway Gen-3 Alpha

```
PROMPT:
Pixar-style 3D animated bust shot, 9:16 crop,
chubby black cat character, navy hoodie with gold star, blue headphones,
TRANSFORMATION ANIMATION: 
  starts with neutral/waiting expression (eyes half-open),
  then EYES SUDDENLY LIGHT UP — pupils dilate, sparkle appears,
  huge grin spreads across face, both paws shoot up in victory/surprise,
  tail puffs up and curls with excitement,
  small stars and musical notes burst outward,
  light flare in eyes (anime-style sparkle),
green screen background for overlay compositing,
Pixar emotional peak animation quality,
7 seconds

MOTION: 
  0-1s: neutral waiting expression
  1-2s: eyes widen suddenly (realization moment)
  2-4s: full excitement — paws up, huge grin, sparkles burst
  4-7s: sustained excitement, paws waving, tail wagging
CAMERA: static bust, very slight push-in at moment of realization
MOOD: pure joy, "I GET IT NOW!", infectious excitement
```

**SIZE NOTE:** PIP overlay, bottom-right, approx 30% width of frame

---

### ▶ Kling AI

```
Pixarスタイル3Dアニメ、バストショット、
ネイビーパーカーの黒猫キャラクター（ライトブルーヘッドフォン）、
最初は普通の表情から突然目がキラキラと輝き出し、
両手（肉球）を上に上げてガッツポーズ、
しっぽがフワッと膨らんで興奮、
星とキラキラが周りに飛び散る、
グリーンバック背景、7秒
```

---

## SCENE E ── まとめ・2ショット [25〜30秒]
### 先生とネコが並んでCTA

---

### ▶ Runway Gen-3 Alpha

```
PROMPT:
Pixar-style 3D animated wide shot, 9:16 vertical,
TWO CHARACTERS SIDE BY SIDE facing camera:

LEFT CHARACTER — female music teacher:
  green cardigan, glasses, light brown bob,
  big warm encouraging smile, right hand giving thumbs up,
  left hand holding baton relaxed at side,
  slight forward lean toward camera

RIGHT CHARACTER — chubby black cat:
  navy hoodie with gold star, blue headphones,
  triumphant double fist-pump pose (both arms raised),
  huge grin showing happy expression,
  tail standing straight up with excited curl at tip,
  slightly bouncing with energy

SCENE:
  both characters looking directly at camera,
  warm pastel background with floating music notes, hearts, stars,
  confetti-like particles gently falling,
  warm golden studio lighting, celebratory mood,
  Pixar end-of-movie satisfaction quality,
  5 seconds with loopable ending

MOTION:
  teacher: sustained thumbs up with small nod, genuine warm smile
  cat: fist pumps once then holds victory pose, tail wagging
  background: particles gently floating down throughout
CAMERA: static wide shot → very subtle slow zoom in
MOOD: celebration, warm completion, "you can do this!"
```

---

### ▶ Pika Labs

```
Two Pixar-style 3D characters side by side in 9:16 vertical:
Left: female teacher in green cardigan giving thumbs up with warm smile.
Right: black cat in navy hoodie doing victory pose with sparkling eyes.
Celebratory mood, musical notes and stars floating around,
warm golden lighting, 5 seconds
```

---

### ▶ Kling AI

```
Pixarスタイル3Dアニメ、縦9:16、
左に女性の音楽先生（グリーンカーディガン・メガネ・サムズアップ・暖かい笑顔）、
右に黒猫（ネイビーパーカー・ライトブルーヘッドフォン・両手ガッツポーズ・目がキラキラ）、
2人並んでカメラ正面を向いている、
背景に音符・ハート・星が舞っている、
暖かいゴールドのライティング、お祝い感、5秒
```

---

### テロップ（Scene E）

```
テキスト1:「メロディ＝「旅」」
  サイズ: 48px / 白 / 縁黒 / 上部配置

テキスト2:「目的地（最高音）を先に決めよう！」
  サイズ: 40px / 白 / 縁黒 / 中央配置

CTA:「💾 保存して試してみて！」
  サイズ: 52px / 黄色 #FFD700 / 縁黒
  位置: 下部 20% / アニメ: バウンスイン
  エフェクト: 点滅（0.5秒サイクル）

ハッシュタグ:「#作曲初心者 #DTM #メロディ作り」
  サイズ: 28px / 半透明白 / 最下部
```

---

## 全シーン制作フロー

```
STEP 1 ── 静止画生成（Midjourney v6）
  各シーンの表情パターンを静止画で生成・確認
  → キャラクターの一貫性を固める

STEP 2 ── 動画生成（Runway / Kling）
  静止画を参照画像としてアップロード
  上記プロンプトで動画を生成（各4〜10秒）

STEP 3 ── 口パク同期（HeyGen / Hedra）
  生成した動画 or 静止画をアップロード
  日本語音声を入力 → 自動口パク生成

STEP 4 ── 合成・編集（CapCut / Premiere）
  Scene B・D のワイプ合成
  テロップ追加（仕様書通り）
  BGM・SE追加（BPM140）

STEP 5 ── 最終確認
  30秒に収まっているか
  テロップが読みやすいか
  感情の流れ：困惑→共感→解説→感動→達成
```

---

## シーン感情マップ（視聴者の気持ちの流れ）

```
[0s]  ネコが悩む      →  「あ、自分も同じ…」（共感）
[3s]  先生が共感      →  「わかってくれる人がいる」（安心）
[8s]  解説スタート    →  「なるほど、聞いてみよう」（興味）
[15s] 重要ポイント    →  「これが答えか！」（期待）
[18s] After再生      →  「おお！！全然違う！」（驚き）
[22s] ネコが感動      →  「自分もできそう！」（希望）
[25s] 2人でまとめ    →  「保存しておこう」（行動）
```

---

## ツール別おすすめ優先度

| シーン | 第1推奨 | 第2推奨 | 理由 |
|--------|---------|---------|------|
| Scene A（ネコ困り顔） | Runway Gen-3 | Kling | 複雑な感情表現 |
| Scene B（先生ワイプ） | HeyGen | Runway | 口パク重要 |
| Scene C-1（先生・驚き） | Runway Gen-3 | Kling | Pixar表情品質 |
| Scene C-2（カウント） | HeyGen | Runway | 指の動き+口パク |
| Scene C-3（強調） | Runway Gen-3 | Pika | 感情ピーク |
| Scene D（ネコ感動） | Runway Gen-3 | Kling | リアクション演技 |
| Scene E（2ショット） | Kling | Runway | 2キャラ同時 |
