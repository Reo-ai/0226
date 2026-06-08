#!/usr/bin/env python3
"""
MIDI Piano Roll Visualizer
MIDIファイルから自動でピアノロール動画（MP4）を生成する

使い方:
  python3 midi_visualizer.py before.mid after.mid --ep 01
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.io import wavfile
import imageio
import struct, os, sys, argparse, tempfile

# ── カラーパレット ──────────────────────────────────────────
BG_COLOR      = (13,  17,  23)   # 背景（ダークネイビー）
GRID_COLOR    = (30,  40,  55)   # グリッド線
WHITE_KEY_ON  = (0,   229, 255)  # メロディノート（シアン）
CHORD_COLOR   = (255, 152,  0)   # コードノート（オレンジ）
PLAYHEAD_COL  = (255, 255, 255)  # 再生ヘッド（白）
BLACK_KEY_COL = (20,  25,  35)   # ピアノ黒鍵
WHITE_KEY_COL = (200, 210, 220)  # ピアノ白鍵
LABEL_COLOR   = (180, 190, 200)  # テキスト

# ── 画面サイズ（TikTok 9:16）──────────────────────────────
W, H          = 1080, 1920
KEYBOARD_W    = 90    # 左端ピアノ鍵盤の幅
TOP_H         = 180   # 上部ヘッダー高さ
BOTTOM_H      = 0     # 下部余白
ROLL_H        = H - TOP_H - BOTTOM_H
NOTE_AREA_W   = W - KEYBOARD_W

# ── MIDI設定 ──────────────────────────────────────────────
TPB           = 480
BPM           = 140
PITCH_LO      = 40    # 表示ピッチ範囲（下限 E2）
PITCH_HI      = 76    # 表示ピッチ範囲（上限 E5）
PITCH_RANGE   = PITCH_HI - PITCH_LO

# ── 表示タイムウィンドウ ───────────────────────────────────
VIEW_TICKS    = TPB * 8   # 画面に映る幅（2小節分）
FPS           = 30

# ──────────────────────────────────────────────────────────
# MIDI パーサー
# ──────────────────────────────────────────────────────────

def read_var_len(data, pos):
    val = 0
    while True:
        b = data[pos]; pos += 1
        val = (val << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return val, pos

def parse_midi(path):
    with open(path, 'rb') as f:
        data = f.read()

    pos = 0
    # MThd
    assert data[pos:pos+4] == b'MThd', "Not a MIDI file"
    pos += 4
    length = struct.unpack('>I', data[pos:pos+4])[0]; pos += 4
    fmt, n_tracks, tpb = struct.unpack('>HHH', data[pos:pos+6]); pos += 6

    notes = []   # (start_tick, pitch, velocity, duration, channel)
    tempo = int(60_000_000 / BPM)

    for _ in range(n_tracks):
        if data[pos:pos+4] != b'MTrk':
            break
        pos += 4
        track_len = struct.unpack('>I', data[pos:pos+4])[0]; pos += 4
        end = pos + track_len

        tick = 0
        pending = {}   # (channel, pitch) → start_tick
        running = 0

        while pos < end:
            delta, pos = read_var_len(data, pos)
            tick += delta

            b = data[pos]
            if b == 0xFF:          # Meta event
                pos += 1
                mtype = data[pos]; pos += 1
                mlen, pos = read_var_len(data, pos)
                pos += mlen
                running = 0
                continue

            if b & 0x80:
                status = b; pos += 1
                running = status
            else:
                status = running

            ch  = status & 0x0F
            cmd = status & 0xF0

            if cmd == 0x90:        # Note On
                pitch = data[pos]; vel = data[pos+1]; pos += 2
                if vel > 0:
                    pending[(ch, pitch)] = tick
                else:
                    if (ch, pitch) in pending:
                        start = pending.pop((ch, pitch))
                        notes.append((start, pitch, vel, tick - start, ch))
            elif cmd == 0x80:      # Note Off
                pitch = data[pos]; vel = data[pos+1]; pos += 2
                if (ch, pitch) in pending:
                    start = pending.pop((ch, pitch))
                    notes.append((start, pitch, vel, tick - start, ch))
            elif cmd in (0xA0, 0xB0, 0xE0):
                pos += 2
            elif cmd in (0xC0, 0xD0):
                pos += 1

        # flush pending
        for (ch, pitch), start in pending.items():
            notes.append((start, pitch, 64, tick - start, ch))

    return sorted(notes, key=lambda n: n[0])

# ──────────────────────────────────────────────────────────
# ピアノ鍵盤 描画
# ──────────────────────────────────────────────────────────

BLACK_KEYS = {1, 3, 6, 8, 10}   # pitch % 12 が黒鍵

def is_black(pitch):
    return (pitch % 12) in BLACK_KEYS

def pitch_to_y(pitch):
    """ピッチ → ロールエリア内Y座標（下が低音）"""
    frac = (pitch - PITCH_LO) / PITCH_RANGE
    return TOP_H + ROLL_H - int(frac * ROLL_H)

def draw_keyboard(draw, active_pitches=set()):
    """左端にピアノ鍵盤を描く"""
    key_h = ROLL_H / PITCH_RANGE

    for p in range(PITCH_LO, PITCH_HI):
        y_top    = pitch_to_y(p + 1)
        y_bottom = pitch_to_y(p)
        active   = p in active_pitches

        if is_black(p):
            col = (0, 200, 220) if active else BLACK_KEY_COL
            draw.rectangle([0, y_top, KEYBOARD_W - 10, y_bottom], fill=col)
        else:
            col = (0, 229, 255) if active else WHITE_KEY_COL
            draw.rectangle([0, y_top, KEYBOARD_W - 1, y_bottom - 1],
                           fill=col, outline=(50, 60, 80))

# ──────────────────────────────────────────────────────────
# グリッド描画
# ──────────────────────────────────────────────────────────

def draw_grid(draw, current_tick):
    """小節線・拍線を描く"""
    measure = TPB * 4
    beat    = TPB

    # 拍線
    for offset in range(-VIEW_TICKS, VIEW_TICKS * 2, beat):
        t = current_tick - VIEW_TICKS // 2 + offset
        if t % beat == 0:
            x = tick_to_x(t, current_tick)
            if 0 <= x <= W:
                col = (45, 60, 80) if t % measure != 0 else (70, 90, 120)
                draw.line([(x, TOP_H), (x, H - BOTTOM_H)], fill=col, width=1)

    # ド（C）の横線
    for p in range(PITCH_LO, PITCH_HI):
        if p % 12 == 0:
            y = pitch_to_y(p)
            draw.line([(KEYBOARD_W, y), (W, y)], fill=(50, 70, 100), width=1)

def tick_to_x(tick, current_tick):
    """ティック → X座標（再生ヘッドが中央）"""
    half = VIEW_TICKS // 2
    return KEYBOARD_W + int((tick - current_tick + half) / VIEW_TICKS * NOTE_AREA_W)

# ──────────────────────────────────────────────────────────
# ノート描画
# ──────────────────────────────────────────────────────────

NOTE_H_MIN = 8   # ノートの最小高さ(px)

def draw_notes(draw, notes, current_tick, label):
    key_h = max(NOTE_H_MIN, int(ROLL_H / PITCH_RANGE) - 1)

    for (start, pitch, vel, dur, ch) in notes:
        if pitch < PITCH_LO or pitch >= PITCH_HI:
            continue

        x1 = tick_to_x(start, current_tick)
        x2 = tick_to_x(start + dur, current_tick)

        if x2 < KEYBOARD_W or x1 > W:
            continue

        x1 = max(x1, KEYBOARD_W)
        x2 = min(x2, W - 2)
        if x2 <= x1:
            continue

        y  = pitch_to_y(pitch + 1)
        y2 = y + key_h

        base_col = WHITE_KEY_ON if ch == 0 else CHORD_COLOR
        # 発音中は明るく
        playing = start <= current_tick < start + dur
        col = base_col if playing else tuple(int(c * 0.55) for c in base_col)

        draw.rectangle([x1, y, x2, y2], fill=col)
        # 上辺にハイライト
        hl = tuple(min(255, c + 60) for c in col)
        draw.line([(x1, y), (x2, y)], fill=hl, width=2)

# ──────────────────────────────────────────────────────────
# ヘッダー描画
# ──────────────────────────────────────────────────────────

def draw_header(draw, label, ep, measure_num, total_measures):
    # 背景バー
    draw.rectangle([0, 0, W, TOP_H], fill=(18, 24, 36))
    draw.line([(0, TOP_H - 1), (W, TOP_H - 1)], fill=(60, 80, 120), width=2)

    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    except:
        font_large = ImageFont.load_default()
        font_small = font_large

    # エピソード番号
    draw.text((40, 20), f"EP {ep:02d}", font=font_small, fill=(100, 140, 180))

    # BEFORE / AFTER ラベル
    col = (255, 80, 80) if label == "BEFORE" else (0, 229, 100)
    prefix = "❌" if label == "BEFORE" else "✅"
    draw.text((40, 65), f"{prefix} {label}", font=font_large, fill=col)

    # 小節表示
    bar_text = f"BAR {measure_num}/{total_measures}"
    draw.text((W - 280, 80), bar_text, font=font_small, fill=(120, 140, 160))

    # BPM / Key
    draw.text((40, 140), f"BPM {BPM}  |  Key: C Major  |  4/4", font=font_small,
              fill=(80, 110, 140))

# ──────────────────────────────────────────────────────────
# 音声合成（サイン波 + エンベロープ）
# ──────────────────────────────────────────────────────────

SAMPLE_RATE = 44100

def midi_note_to_freq(pitch):
    return 440.0 * (2 ** ((pitch - 69) / 12))

def synthesize(notes, total_ticks, bpm=BPM, tpb=TPB):
    secs_per_tick = (60.0 / bpm) / tpb
    total_secs    = total_ticks * secs_per_tick + 1.0
    total_samples = int(total_secs * SAMPLE_RATE)
    audio         = np.zeros(total_samples, dtype=np.float32)

    for (start, pitch, vel, dur, ch) in notes:
        freq    = midi_note_to_freq(pitch)
        t_start = int(start * secs_per_tick * SAMPLE_RATE)
        dur_s   = dur * secs_per_tick
        n_samp  = int(dur_s * SAMPLE_RATE)

        if n_samp < 1:
            continue

        t = np.linspace(0, dur_s, n_samp, endpoint=False)
        # 倍音を含む波形（ピアノっぽく）
        wave = (np.sin(2 * np.pi * freq * t) * 0.6 +
                np.sin(2 * np.pi * freq * 2 * t) * 0.25 +
                np.sin(2 * np.pi * freq * 3 * t) * 0.1)

        # ADSR エンベロープ
        atk = min(int(0.01 * SAMPLE_RATE), n_samp // 4)
        rel = min(int(0.15 * SAMPLE_RATE), n_samp // 2)
        env = np.ones(n_samp)
        env[:atk] = np.linspace(0, 1, atk)
        env[-rel:] = np.linspace(1, 0, rel)

        vol = (vel / 127) * (0.4 if ch == 1 else 0.7)
        end = min(t_start + n_samp, total_samples)
        audio[t_start:end] += (wave[:end - t_start] * env[:end - t_start] * vol)

    # クリッピング防止
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio /= peak
    audio = (audio * 32767).astype(np.int16)
    return audio

# ──────────────────────────────────────────────────────────
# メイン：動画生成
# ──────────────────────────────────────────────────────────

def generate_video(midi_path, output_path, label="BEFORE", ep=1):
    print(f"  Parsing {os.path.basename(midi_path)} ...")
    notes = parse_midi(midi_path)

    if not notes:
        print("  ERROR: no notes found"); return

    total_ticks = max(s + d for s, _, _, d, _ in notes) + TPB * 2
    total_measures = int(total_ticks / (TPB * 4)) + 1

    secs_per_tick = (60.0 / BPM) / TPB
    total_secs    = total_ticks * secs_per_tick
    total_frames  = int(total_secs * FPS) + FPS  # +1秒の余白

    ticks_per_frame = (TPB * BPM) / (60 * FPS)

    print(f"  Synthesizing audio ...")
    audio = synthesize(notes, total_ticks)

    print(f"  Rendering {total_frames} frames ...")
    frames = []

    for frame_idx in range(total_frames):
        current_tick = frame_idx * ticks_per_frame

        img  = Image.new('RGB', (W, H), BG_COLOR)
        draw = ImageDraw.Draw(img)

        # グリッド
        draw_grid(draw, current_tick)

        # 発音中ピッチ収集
        active = {p for (s, p, v, d, ch) in notes
                  if s <= current_tick < s + d and ch == 0}

        # 鍵盤
        draw_keyboard(draw, active)

        # ノート
        draw_notes(draw, notes, current_tick, label)

        # 再生ヘッド
        px = KEYBOARD_W + NOTE_AREA_W // 2
        draw.line([(px, TOP_H), (px, H)], fill=PLAYHEAD_COL, width=3)
        # ヘッドのグロー効果
        for glow in range(1, 5):
            alpha_col = tuple(int(c * (0.3 / glow)) for c in PLAYHEAD_COL)
            draw.line([(px - glow, TOP_H), (px - glow, H)], fill=alpha_col, width=1)
            draw.line([(px + glow, TOP_H), (px + glow, H)], fill=alpha_col, width=1)

        # ヘッダー
        measure_num = int(current_tick / (TPB * 4)) + 1
        draw_header(draw, label, ep, measure_num, total_measures)

        frames.append(np.array(img))

    print(f"  Writing video: {output_path} ...")
    with imageio.get_writer(output_path, fps=FPS, codec='libx264',
                            quality=8, macro_block_size=None) as writer:
        for f in frames:
            writer.append_data(f)

    # 音声を結合（ffmpegが使えれば）
    tmp_wav = output_path.replace('.mp4', '_tmp.wav')
    final   = output_path.replace('.mp4', '_sound.mp4')
    try:
        wavfile.write(tmp_wav, SAMPLE_RATE, audio)
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ret = os.system(
            f'"{ffmpeg_exe}" -y -i "{output_path}" -i "{tmp_wav}" '
            f'-c:v copy -c:a aac -shortest "{final}" 2>/dev/null'
        )
        if ret == 0:
            os.remove(output_path)
            os.remove(tmp_wav)
            print(f"  ✅ Done: {final}")
        else:
            print(f"  ✅ Done (no audio): {output_path}")
    except Exception as e:
        print(f"  ✅ Done (no audio): {output_path}  ({e})")


# ──────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="MIDI Piano Roll Visualizer")
    ap.add_argument("before_mid",         help="Before MIDIファイルパス")
    ap.add_argument("after_mid",          help="After MIDIファイルパス")
    ap.add_argument("--ep",  type=int, default=1, help="エピソード番号")
    ap.add_argument("--out", default=".",         help="出力ディレクトリ")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ep = args.ep

    generate_video(
        args.before_mid,
        os.path.join(args.out, f"ep{ep:02d}_before_roll.mp4"),
        label="BEFORE", ep=ep
    )
    generate_video(
        args.after_mid,
        os.path.join(args.out, f"ep{ep:02d}_after_roll.mp4"),
        label="AFTER", ep=ep
    )
    print("\n🎬 All done!")
