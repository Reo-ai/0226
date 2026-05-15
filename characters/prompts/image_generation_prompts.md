# AI画像生成プロンプト集
## Midjourney / DALL-E 3 / Stable Diffusion 対応

---

## ベースプロンプト（キャラクター固定用）

### 作曲先生 ── ベース

```
Pixar-style 3D animated character, female music teacher in her early 30s,
short wavy light brown bob hair, round thin-framed glasses,
bright green cardigan over white blouse with patterned scarf,
holding a conductor's baton, warm friendly smile,
soft studio lighting, high quality render, expressive large eyes,
smooth skin with subsurface scattering, Pixar "Soul" style,
white/light gray background
--ar 9:16 --style raw --q 2
```

### 作曲ネコ ── ベース

```
Pixar-style 3D animated character, chubby black cat person standing upright,
wearing navy blue hoodie with gold star on chest,
large light blue headphones over cat ears, sleepy half-closed green eyes,
holding a pencil, fluffy long tail,
soft studio lighting, high quality render, round adorable design,
Pixar "Soul" style, white/light gray background
--ar 9:16 --style raw --q 2
```

---

## 感情別プロンプト ── 作曲先生

### 通常解説（笑顔・指差し）
```
[ベースプロンプト] + 
pointing finger gesture, warm smile, explaining pose,
music notes floating around, slight forward lean
```

### 驚き・発見
```
[ベースプロンプト] + 
surprised expression, wide eyes, open mouth slightly,
hands raised in eureka pose, eyebrows raised
```

### うなずき・共感
```
[ベースプロンプト] + 
nodding gently, soft empathetic smile, hands clasped,
slight head tilt, understanding expression
```

### 励まし・応援
```
[ベースプロンプト] + 
thumbs up gesture, big encouraging smile,
leaning forward, energetic positive pose
```

### 重要ポイント強調
```
[ベースプロンプト] + 
holding up index finger "one point" gesture,
serious but kind expression, slight eyebrow raise
```

---

## 感情別プロンプト ── 作曲ネコ

### 困り顔（悩む）
```
[ベースプロンプト] + 
troubled expression, paws on cheeks, 
question marks floating above head,
slumped posture, droopy tail
```

### あくび（眠い・諦め気味）
```
[ベースプロンプト] + 
wide yawn expression, paw covering mouth,
drowsy half-lidded eyes, slouching posture,
"zzz" floating nearby
```

### 目を輝かせる（理解した！）
```
[ベースプロンプト] + 
sparkling bright eyes wide open, huge excited smile,
both paws raised in excitement, 
light bulb above head, tail straight up with curl
```

### ずっこける（コミカル失敗）
```
[ベースプロンプト] + 
falling over comically, swirly confused eyes,
legs in the air, musical notes scattered around,
exaggerated Pixar comedy pose
```

### ガッツポーズ（できた！）
```
[ベースプロンプト] + 
triumphant fist pump pose, huge grin showing teeth,
both arms raised, tail puffed up with excitement,
sparkles and stars surrounding character
```

### 首をかしげる（疑問）
```
[ベースプロンプト] + 
head tilted 45 degrees, one ear perked up,
curious puzzled expression, paw on chin,
question mark above head
```

---

## 2ショットプロンプト（2人並んだシーン）

```
Pixar-style 3D animated scene, two characters side by side:
LEFT: female music teacher, short wavy light brown hair, round glasses, 
green cardigan, holding baton, warm smile
RIGHT: chubby black cat in navy hoodie with gold star, 
light blue headphones, sleepy eyes, holding pencil
Both characters looking at viewer, soft warm studio lighting,
clean simple background with subtle music elements,
high quality Pixar render, expressive eyes
--ar 16:9 --style raw --q 2
```

---

## 背景プロンプト（シーン別）

### DAW部屋（作業シーン）
```
Pixar-style 3D animated music studio room background,
computer with DAW software on screen, MIDI keyboard,
warm desk lamp, music notes on walls, cozy and creative atmosphere,
soft depth of field blur, no characters
```

### シンプルスタジオ（解説シーン）
```
Clean minimal studio background, soft gradient from light blue to white,
floating musical notes and treble clef decorations,
warm studio lighting, Pixar animation style backdrop
```

### タイトルカード背景
```
Pixar-style animated music classroom background,
chalkboard with music staff lines, colorful note decorations,
warm cozy atmosphere, no text, no characters
```

---

## 動画生成ツール別メモ

### Runway Gen-3 Alpha
- 上記プロンプトをそのまま使用可
- Motion: "subtle breathing and blinking" を追加するとリアルに
- Duration: 4〜8秒が最適

### Pika Labs
- キャラクター一貫性のため参照画像（reference image）を必ず使用
- Modify region で口の動きだけ変更する使い方も効果的

### HeyGen / D-ID（口パク同期）
- 生成した静止画をアップロード
- 音声（日本語TTS）と口パクを自動同期
- 感情表現は静止画の表情に依存するため表情指定が重要

### Kling AI
- 日本語プロンプト対応
- キャラクター固定には「参考画像＋プロンプト」の組み合わせが◎
