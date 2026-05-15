# Episode #01 ── Higgsfield & Kling 動画生成プロンプト
## 喋りパート全シーン / TikTok縦動画 9:16 / Pixar風3Dアニメ

---

## ツール特性メモ

```
【Higgsfield】
- シネマティックな動きが得意
- カメラワーク指定が効きやすい（"dolly in", "rack focus"等）
- キャラクターの演技・感情表現が豊か
- 参照画像（Reference Image）があるとキャラ固定に強い
- 英語プロンプト推奨
- 推奨クリップ長: 4〜8秒

【Kling AI】
- Subject Reference でキャラクター一貫性が高い
- 日本語・英語どちらも対応
- 感情表現と細かい動作指定が得意
- Negative Prompt が効果的
- 推奨クリップ長: 5〜10秒
- Professional モード推奨（高品質）
```

---

---

# SCENE A ── フック [0〜3秒]
## ネコ：困り顔「なんかメロディが地味ニャ…」

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated short film scene, vertical 9:16 aspect ratio.
A chubby adorable black anthropomorphic cat character wearing a navy blue
hoodie with a gold star on the chest, large light-blue over-ear headphones
slightly tilted on the head. The cat sits slumped at a tiny music keyboard,
both round paws pressed against cheeks in an overwhelmed, worried expression.
Half-lidded sleepy green eyes filled with confusion and mild despair.
Fluffy long tail drooping sadly between the legs.
Three glowing question mark symbols (???) float and slowly rotate above the head.
Scattered musical notes drift chaotically in the background.
Soft pastel blue-to-lavender gradient background. Warm rim lighting outlining
the character with a gentle glow. Subsurface scattering on the skin/fur.
High-quality Pixar "Soul" level render. Highly expressive face.

CAMERA: Starts as a medium shot showing full upper body, then slowly dollies
in to a close-up bust shot over 3 seconds. Slight rack focus as it moves in.

LIGHTING: Soft three-point lighting — warm key from upper left,
soft fill from right, cool rim light from behind.

MOOD: Confused, troubled, relatable struggle. Endearing not sad.

MOTION: Subtle idle breathing, slight body sway left-right (0.5s cycle),
tail slowly swings once, single slow blink at 1.5s mark.

STYLE REF: Pixar "Soul", "Turning Red", Illumination "Sing" character quality.
Duration: 3 seconds, 30fps, 1080x1920
```

**Higgsfield Camera preset:** `Dolly In (Slow)` + `Depth of Field: Medium`

---

## 🎬 Kling AI

**モード:** Image-to-Video（Midjourneyで生成した静止画を参照）  
**設定:** Professional / High Quality / 5秒

```
【English Prompt】
Pixar-style 3D animated chubby black cat character in navy blue hoodie
with gold star, wearing large light-blue headphones.
Sitting at a small keyboard looking troubled and confused,
both paws on cheeks, half-lidded worried green eyes,
three question marks floating above head, drooping tail.
Soft pastel blue studio background, warm rim lighting.
Camera slowly pushes in from medium to bust close-up.
Subtle breathing, gentle body sway, single blink.
Pixar animation quality, 9:16 vertical, 5 seconds.

【Negative Prompt】
realistic, photorealistic, scary, dark, horror, 
sharp lines, adult content, human hands, text overlay,
multiple characters, blurry face
```

```
【日本語プロンプト（Kling日本語モード）】
Pixarスタイルの3Dアニメ、縦9:16。
ネイビーブルーのパーカー（胸に金色の星マーク）を着た、
ふくよかでかわいい黒猫キャラクター。
ライトブルーの大きなヘッドフォンをつけて、
小さなキーボードの前に座り、両手（肉球）を頬に当てて困った表情。
半目の緑色の瞳が不安そうに揺れ、頭上に「？？？」が3つ浮かんでいる。
しっぽがしょんぼりと垂れ下がっている。
パステルブルーのグラデーション背景、暖かいリムライト。
カメラがゆっくりとミディアムショットからバストショットに寄っていく。
微妙に身体が揺れ、ゆっくり1回瞬きする。5秒。

【ネガティブプロンプト】
リアル調、ホラー、暗い、鋭いエッジ、テキスト、複数キャラクター、ぼやけた顔
```

**Kling Tips:**
- Subject Reference に作曲ネコの静止画を設定
- Motion Strength: 6〜7（動きすぎず）
- Creativity: 5

---

---

# SCENE B-WIPE ── Before ワイプ [3〜8秒]
## 先生：共感・うなずき（右下小窓用）

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated bust shot, vertical 9:16 crop.
A warm and friendly female music teacher in her early 30s.
Short wavy light brown bob haircut, round thin-framed glasses,
bright green cardigan over a white blouse, patterned silk scarf.
Expression: genuine empathy and understanding — soft warm smile forming,
eyes crinkled slightly with compassion, slowly nodding head twice
as if listening to a student's problem and fully understanding.
Eyebrows gently raised in recognition: "I know exactly what you mean."
Pure green (#00FF00) chroma-key background — clean isolation for compositing.
Soft warm studio three-point lighting. No background clutter.
Pixar character quality — smooth skin with subsurface scattering,
expressive large brown eyes with highlight sparkle.

CAMERA: Static bust shot. Face occupies upper 60% of frame.
Slight soft focus on background (none, since green screen).

MOTION: Two gentle forward nods (at 1s and 3s), 
warm smile grows from neutral to full by 2s,
small empathetic head tilt to the left at 4s,
natural breathing throughout.

MOOD: "I hear you. I understand. You're not alone."
Duration: 5 seconds, 30fps. Green screen ready.
```

**Higgsfield Camera preset:** `Static` + `Green Screen Mode`

---

## 🎬 Kling AI

```
【English Prompt】
Pixar-style 3D bust shot of a friendly female music teacher,
light brown wavy bob hair, round glasses, bright green cardigan.
Warm empathetic expression, slowly nodding twice in understanding,
soft smile growing on face, slight compassionate head tilt.
Pure green (#00FF00) chroma key background for compositing.
Soft warm studio lighting, Pixar render quality.
Face fills upper half of frame. Natural breathing. 5 seconds.

【Negative Prompt】
background objects, shadows on green screen, 
harsh lighting, sad expression, multiple characters,
photorealistic, text, props blocking face
```

```
【日本語プロンプト】
Pixarスタイル3Dアニメ、バストショット縦構図。
ライトブラウンのウェーブボブ、丸メガネ、
明るいグリーンのカーディガンを着た親しみやすい女性音楽先生。
温かく共感した表情で、ゆっくり2回うなずく。
「わかりますよ」という優しい微笑みが広がる。
左に少し頭を傾けて共感を示す。
グリーンバック（#00FF00）背景、合成用クロマキー。
ソフトな暖色スタジオライティング。顔がフレーム上半分を占める。
自然な呼吸の動き。5秒。

【ネガティブプロンプト】
背景オブジェクト、グリーンスクリーンへの影、
ハードライティング、悲しい表情、複数キャラクター
```

---

---

# SCENE C-1 ── 解説①「実はたった3つのことで変わる！」[8〜11秒]
## 先生：驚き・発見・テンションUP

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated medium shot, 9:16 vertical.
Enthusiastic female music teacher — light brown bob, round glasses, 
green cardigan — in the middle of an exciting revelation moment.
She raises her right index finger upward with conviction and energy,
simultaneously leaning slightly forward toward the camera,
eyes go wide and sparkling with excitement (anime-style eye sparkle),
eyebrows shoot up, open warm smile showing genuine enthusiasm.
The moment feels like: "Wait — here's the secret nobody told you!"
Soft musical note particles and sparkle effects burst outward
from around her finger as she raises it.
Warm cream-to-mint pastel gradient background.
Three-point studio lighting with warm key light, 
golden rim light creating an energetic halo effect.
Pixar "Soul" / "Inside Out" level emotional expressiveness.

CAMERA: Starts medium shot (waist up), 
slowly dollies in to bust shot over 3 seconds.
Slight upward tilt of camera (eye-level to slight low angle)
to create sense of authority and "I have the answer" energy.

MOTION: 
  0-0.5s: neutral to building expression
  0.5-1s: index finger raises with flourish (wrist snap)
  1-1.5s: body leans forward, eyes widen fully
  1.5-3s: sustained excitement, slight head nod of emphasis
  sparkle particles burst at 1s mark

MOOD: Excited revelation, energetic, trustworthy expert.
Duration: 3 seconds, 30fps, 1080x1920
```

---

## 🎬 Kling AI

```
【English Prompt】
Pixar-style 3D animated medium shot, 9:16 vertical.
Excited female music teacher, light brown bob, round glasses, green cardigan.
Raises right index finger upward with energy and enthusiasm,
leans slightly forward toward camera, eyes wide and sparkling,
big warm smile of revelation — "I have the answer!"
Musical note sparkles burst around her raised finger.
Warm cream-mint pastel background, golden studio lighting.
Camera slowly dollies from medium to bust shot.
Pixar "Inside Out" level expressiveness. 3 seconds.

【Negative Prompt】
sad, tired, static, stiff, serious/stern face,
photorealistic, multiple people, messy background,
dark lighting, text in scene
```

```
【日本語プロンプト】
Pixarスタイル3Dアニメ、縦9:16、ミディアムショット。
ライトブラウンボブ・丸メガネ・グリーンカーディガンの女性音楽先生。
右手の人差し指を勢いよく上に立てて、少し前のめりになる。
目がキラキラと大きく見開かれ、「答えがここにある！」という
発見の笑顔を浮かべる。
指の先から音符とキラキラのパーティクルが飛び散る。
暖かいクリーム〜ミントのパステル背景、ゴールドのスタジオライティング。
カメラがゆっくりとミディアムからバストショットに寄る。3秒。

【ネガティブプロンプト】
暗い表情、静止、硬い動き、リアル調、複数人物、ごちゃついた背景
```

**Kling Tips:**
- Subject Reference に作曲先生の静止画（驚き顔）を使用
- Motion Strength: 7（感情表現のため少し高め）

---

---

# SCENE C-2 ── 解説②「①音域を広げる ②リズムを変える」[11〜15秒]
## 先生：指カウント・ステップ解説

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated bust shot, 9:16 vertical.
Confident female music teacher — light brown bob, round glasses, green cardigan —
in clear step-by-step teaching mode.
Left hand holds a small conductor's baton relaxed at chest height.
Right hand counts points on fingers:
  BEAT 1: Index finger extends upward — "Point one" 
  BEAT 2: Middle finger joins — "Point two"
Expression is clear, focused, warm, teacher-in-action energy.
Between each point, slight pause and head tilt in opposite direction,
eyes maintain direct contact with camera (audience).
Mouth moving as if clearly articulating each point.
Warm cream-colored studio background, professional but approachable.
Soft key light from upper-left, gentle fill, subtle rim light.
Pixar character animation fluidity — finger movements are smooth and deliberate.

CAMERA: Static bust shot. Occasional very subtle reframing (micro push).
Eye level camera angle — equal relationship with viewer.

MOTION:
  0-1s: neutral start, baton in left hand, right hand at rest
  1-2s: right index finger extends upward (Point 1)
  2-2.5s: brief pause with nod
  2.5-3.5s: middle finger joins index (Point 2)  
  3.5-4s: brief pause with head tilt + confirming nod
  Natural mouth movement throughout (lip sync ready)

MOOD: Clear, step-by-step, confident teacher. "You can follow this."
Duration: 4 seconds, 30fps, 1080x1920
```

---

## 🎬 Kling AI

```
【English Prompt】
Pixar-style 3D animated bust shot, 9:16.
Female music teacher, light brown bob, round glasses, green cardigan,
counting steps on fingers: extends index finger first (point 1),
then adds middle finger (point 2), with clear pauses and head tilts
between each point, maintaining warm eye contact with camera.
Left hand holds small conductor's baton. Mouth moves as if speaking.
Warm cream studio background, professional studio lighting.
Smooth deliberate finger movements, Pixar animation quality. 4 seconds.

【Negative Prompt】
fast movement, blurry hands, nervous expression,
harsh lighting, distorted fingers, photorealistic
```

```
【日本語プロンプト】
Pixarスタイル3Dアニメ、バストショット縦9:16。
ライトブラウンボブ・丸メガネ・グリーンカーディガンの女性音楽先生。
右手で指を折って数えながら説明する。
まず人差し指を立てて「①」、次に中指も加えて「②」と示す。
各ポイントの間に少し間を置いて頷き、頭を反対側に傾ける。
左手に小さな指揮棒を持つ。口が話すように動いている。
温かみのあるクリーム色のスタジオ背景、プロフェッショナルな照明。
滑らかで意図的な指の動き。4秒。

【ネガティブプロンプト】
速い動き、ぼやけた手、指の歪み、リアル調、暗い照明
```

---

---

# SCENE C-3 ── 解説③「最高音は1か所だけ！」[15〜18秒]
## 先生：クローズアップ強調・最重要ポイント

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated close-up bust shot, 9:16 vertical.
Female music teacher — light brown bob, round glasses, green cardigan —
delivering the most important point with controlled but powerful emphasis.
Expression: knowing, confident, slightly conspiratorial smile —
like sharing a professional secret.
Right hand raises ONE finger (index finger, pointing up) with deliberate emphasis,
holds it at eye level. Then the finger gently taps her temple twice
as if to say "remember this in your mind."
A small golden star / sparkle effect appears at the fingertip.
Eyes slightly wider than normal — "this is THE thing to remember."
Slight inhale/pause before the gesture for dramatic effect.
Background: warm cream studio, slightly darker than previous scenes
(to signal importance / climax of the explanation sequence).
Dramatic but soft lighting — slightly stronger key light creates
gentle shadow on opposite side, adding gravitas.
Pixar "Coco" / "Brave" level of emotional clarity in the face.

CAMERA: Starts as bust shot, very slowly pushes to tight close-up (face + shoulders).
Slightly lower angle than eye level — subtle authority framing.
Rack focus: slight pull during finger raise.

MOTION:
  0-0.5s: neutral breath-in (pause for emphasis)
  0.5-1s: index finger rises deliberately to eye level
  1-2s: hold finger up, eyes widen, knowing smile forms
  2-2.5s: finger taps temple twice (tap tap)
  2.5-3s: gold sparkle at fingertip, slow knowing nod

MOOD: "This. Is. The. Secret." — satisfying revelation, trustworthy.
Duration: 3 seconds, 30fps, 1080x1920
```

---

## 🎬 Kling AI

```
【English Prompt】
Pixar-style 3D close-up bust shot, 9:16 vertical.
Female music teacher, green cardigan, round glasses, light brown bob.
Raises single index finger with deliberate emphasis and knowing smile,
eyes slightly wider — sharing the most important secret.
Finger then taps temple twice as if to say "remember this."
Small golden sparkle effect at fingertip.
Dramatic but warm studio lighting, slightly lower camera angle.
Very slow push-in from bust to close-up. Pixar "Coco" expressiveness. 3 seconds.

【Negative Prompt】
fast movement, nervous, multiple fingers raised, dark mood,
photorealistic, blurry, distorted face, over-lit
```

```
【日本語プロンプト】
Pixarスタイル3Dアニメ、クローズアップバストショット、縦9:16。
グリーンカーディガン・丸メガネ・ライトブラウンボブの女性音楽先生。
人差し指1本をゆっくりと目の高さまで立て、「これが一番重要」という
確信に満ちた優しい笑顔を浮かべる。
目が少し大きく見開かれ、プロの秘密を教えるような表情。
指先を2回こめかみに軽くタップ（「覚えておいて」のジェスチャー）。
指先に小さな金色のキラキラエフェクト。
ドラマチックだが温かいスタジオライティング、
カメラがわずかに低い角度からゆっくりとクローズアップに寄る。3秒。

【ネガティブプロンプト】
速い動き、複数の指、暗い雰囲気、リアル調、ぼやけた顔
```

---

---

# SCENE D-WIPE ── After ワイプ [18〜25秒]
## ネコ：衝撃のリアクション→感動ガッツポーズ（右下小窓）

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated bust shot, 9:16 vertical, green screen background.
Chubby black anthropomorphic cat in navy hoodie with gold star, blue headphones.

TWO-PHASE ANIMATION:

PHASE 1 — Waiting/Processing (0-2s):
  Cat sits slightly tense, eyes half-open in neutral-to-curious expression,
  head tilted slightly forward, tail gently flicking — like listening intently.
  One paw raised slightly as if anticipating something.

PHASE 2 — EXPLOSION of realization and joy (2-7s):
  Eyes SNAP open to maximum size — anime-style sparkle burst in pupils,
  two distinct highlight stars appear in each eye,
  jaw drops slightly then huge grin spreads ear to ear,
  BOTH paws shoot upward in double fist-pump victory pose,
  tail PUFFS out to twice normal size and stands straight up with excited curl,
  small stars, musical notes, and heart symbols burst outward in all directions,
  entire body bounces with energy,
  headphones bounce on head from the sudden movement.

Pure green (#00FF00) background — clean chroma key for compositing.
Warm rim light on character edges for clean keying.
Pixar peak emotional moment quality.

CAMERA: Static bust shot. Very slight push-in during Phase 2 reveal.

MOOD: The most infectious joy. The "everything clicked" moment.
      Makes viewers feel: "I want to feel that too!"
Duration: 7 seconds, 30fps, Green Screen
```

**Higgsfield Camera preset:** `Static (Locked)` + `Green Screen`

---

## 🎬 Kling AI

```
【English Prompt】
Pixar-style 3D animated bust shot, 9:16, green screen (#00FF00) background.
Chubby black cat in navy hoodie with gold star, large blue headphones.

PHASE 1 (first 2 seconds): Cat waiting with half-open curious eyes,
head tilted forward, tail gently flicking in anticipation.

PHASE 2 (seconds 2-7): SUDDEN transformation — eyes snap open wide 
with anime sparkle burst, huge ear-to-ear grin, both paws shoot up 
in double victory fist-pump, tail puffs up and stands straight with curl,
stars and musical notes explode outward, body bounces with pure joy,
headphones bounce from the excitement.

Warm rim lighting on edges for clean green screen keying.
Pixar peak emotional animation. 7 seconds.

【Negative Prompt】
sad, neutral, static, stiff animation, dark background 
(must be pure green), harsh shadows on background,
multiple characters, photorealistic
```

```
【日本語プロンプト】
Pixarスタイル3Dアニメ、バストショット縦9:16。
グリーンバック（#00FF00）背景、合成用。
ネイビーブルーパーカー（金色星マーク）・ライトブルーヘッドフォンの黒猫キャラ。

【前半2秒】半目で少し緊張した様子でじっと待っている。
頭を少し前に傾け、しっぽがゆっくりと揺れる。

【後半5秒】突然目が最大限に見開かれ、瞳にアニメ風のキラキラが弾ける。
耳まで届くような満面の笑みが広がる。
両手（肉球）が勢いよく上に上がってダブルガッツポーズ。
しっぽがフワッと膨らみ、興奮してピンと立つ。
星・音符・ハートが四方八方に弾け飛ぶ。
全身がバウンスし、ヘッドフォンが跳ねる。
グリーンバックのエッジに暖かいリムライト（クロマキー合成用）。7秒。

【ネガティブプロンプト】
暗い表情、静止した動き、グリーン以外の背景、背景への影、複数キャラ
```

**Kling Tips:**
- Motion Strength: **8〜9**（Phase 2の爆発的リアクションのため高め）
- Phase 1と2でクリップを2本に分けてもOK
- Creativity: 6

---

---

# SCENE E ── まとめ・2ショットCTA [25〜30秒]
## 先生＋ネコ：2人並んで視聴者に呼びかけ

---

## 🎬 Higgsfield

```
MAIN PROMPT:
Pixar-style 3D animated wide shot, 9:16 vertical.
TWO CHARACTERS together in a warm celebratory scene:

LEFT — MUSIC TEACHER:
  Female, light brown bob, round glasses, green cardigan,
  facing camera directly, giving a warm genuine thumbs-up with right hand,
  left hand holding baton relaxed at side,
  big open encouraging smile — eyes bright and warm,
  slight forward lean toward camera — "You've got this!"

RIGHT — COMPOSITION CAT:
  Chubby black cat, navy hoodie with gold star, blue headphones,
  both paws raised high in triumphant double-fist-pump,
  huge grin, sparkling wide eyes,
  tail standing straight up and curling with excitement,
  slight bounce/bop with energy,
  headphones slightly askew from the excitement.

SCENE ELEMENTS:
  Both characters standing at slight angles toward each other
  but both facing camera — creating a warm "team" feeling.
  Warm golden studio background with subtle gradient.
  Celebration particles: small musical notes, hearts, and stars
  gently floating and drifting downward around both characters.
  Subtle confetti sprinkle in background.
  Warm golden-hour quality studio lighting on both characters.
  Soft rim lights outlining each character.
  Shared warm glow between them.

CAMERA: Wide shot framing both characters clearly,
slight slow zoom-in (barely perceptible) over 5 seconds.
Both characters centered, teacher slightly higher/taller (natural height).

MOTION:
  Teacher: sustained thumbs-up, warm nod at 2s, smile maintained
  Cat: fist pumps once (1s) then holds victory pose,
       tail wags back and forth gently,
       tiny happy bounce every 2 seconds
  Particles: constant gentle drift downward

MOOD: Pure warm satisfaction. Team achievement. "We did it together."
      Makes viewer feel: "I want to be part of this."
Duration: 5 seconds, 30fps, 1080x1920
```

**Higgsfield Camera preset:** `Slow Zoom In` + `Wide Shot`

---

## 🎬 Kling AI

```
【English Prompt】
Pixar-style 3D animated wide shot, 9:16 vertical.
TWO CHARACTERS side by side facing camera:

LEFT: Female music teacher (light brown bob, round glasses, green cardigan)
giving thumbs-up with warm encouraging smile, slight forward lean,
right hand thumbs-up, left hand holding baton relaxed.

RIGHT: Chubby black cat (navy hoodie with gold star, blue headphones)
doing triumphant double fist-pump with both paws raised high,
huge grin, sparkling eyes, tail standing straight up and wagging,
slight happy bounce.

Warm golden studio background, celebration particles (musical notes,
hearts, stars) gently floating down around both characters.
Soft golden lighting on both, warm shared glow between them.
Both characters create a warm "team" feeling.
Very slow subtle zoom-in. 5 seconds.

【Negative Prompt】
characters facing each other (must face camera),
sad or neutral expressions, dark lighting,
separate backgrounds, photorealistic,
characters too far apart, missing characters
```

```
【日本語プロンプト】
Pixarスタイル3Dアニメ、ワイドショット縦9:16。
2キャラクターが並んでカメラ正面を向いている。

【左：作曲先生】
ライトブラウンボブ・丸メガネ・グリーンカーディガンの女性先生。
右手でサムズアップ、左手に指揮棒を持ち自然に下ろす。
温かく励ます笑顔で少し前傾み。目がキラキラと輝いている。

【右：作曲ネコ】
金星マーク付きネイビーパーカー・ライトブルーヘッドフォンの黒猫。
両手（肉球）を高く上げてダブルガッツポーズ。
満面の笑みで目がキラキラ。しっぽがピンと立ってゆらゆら揺れる。
小さくバウンスしている。

背景：暖かいゴールドのスタジオ背景。
音符・ハート・星が2人の周りをゆっくりと舞い落ちている。
両キャラクターに暖かいゴールドの照明。
ごく緩やかにカメラが寄っていく。5秒。

【ネガティブプロンプト】
キャラクター同士が向き合っている、暗い表情、暗い照明、
リアル調、キャラクターが離れすぎている、背景がバラバラ
```

**Kling Tips:**
- 2キャラ同時生成は難しいため、**別々に生成→CapCutで合成**も有効
- Subject Referenceに2キャラの合成静止画を使うと一貫性UP
- Motion Strength: 6（落ち着いた祝福ムード）

---

---

## 制作順序（推奨）

```
STEP 1: Midjourneyで各表情の静止画を作成
  → 作曲先生 × 5表情（共感/驚き/カウント/強調/励まし）
  → 作曲ネコ  × 3表情（困惑/待機/大喜び）

STEP 2: Higgsfieldで演技クリップを生成（Scene C-1, C-3, Scene E）
  → 参照画像あり＝キャラ固定に強い

STEP 3: Klingでリアクションクリップを生成（Scene A, D-Wipe）
  → Subject Reference設定で黒猫の一貫性を維持

STEP 4: Scene B-Wipe（先生小窓）はKling + グリーンバック
  → CapCutでDAW画面にワイプ合成

STEP 5: Scene Eの2ショット
  → Higgsfieldで挑戦 → うまくいかなければ別々生成→合成

STEP 6: 口パク同期（HeyGen / Hedraで仕上げ）
```

---

## クリップ尺まとめ

| Scene | ツール | 秒数 | グリーンバック |
|-------|--------|------|--------------|
| A（ネコ困り顔） | Kling | 5秒 | なし |
| B-Wipe（先生共感） | Kling | 5秒 | **あり** |
| C-1（先生驚き） | Higgsfield | 3秒 | なし |
| C-2（先生カウント） | Higgsfield | 4秒 | なし |
| C-3（先生強調） | Higgsfield | 3秒 | なし |
| D-Wipe（ネコ感動） | Higgsfield | 7秒 | **あり** |
| E（2ショット） | Kling or Higgsfield | 5秒 | なし |
| **合計** | | **32秒** | |
