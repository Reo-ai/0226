#!/usr/bin/env python3
"""
Before/After MIDI generator
#01: メロディが単調になる
BPM=140, Key=C Major, 4/4, 4 measures
Chord: C -> Am -> F -> G
"""

import struct, os

# --- MIDI encoding ---

def var_len(n):
    if n == 0:
        return b'\x00'
    out = []
    while n:
        out.append(n & 0x7F)
        n >>= 7
    out.reverse()
    for i in range(len(out) - 1):
        out[i] |= 0x80
    return bytes(out)

def make_header(fmt, n_tracks, tpb):
    return b'MThd' + struct.pack('>IHHH', 6, fmt, n_tracks, tpb)

def make_track(events):
    body = b''.join(events)
    return b'MTrk' + struct.pack('>I', len(body)) + body

# --- Constants ---

TPB = 480
BPM = 140
Q   = TPB       # quarter  = 480 ticks
E   = TPB // 2  # eighth   = 240 ticks
H   = TPB * 2   # half     = 960 ticks
W   = TPB * 4   # whole    = 1920 ticks (1 measure)

# MIDI note numbers  (C4 = middle C = 60)
C4,D4,E4,F4,G4,A4,B4 = 60,62,64,65,67,69,71
C3,E3,G3             = 48,52,55   # C chord
A2,C3b,E3b           = 45,48,52  # Am chord
F2,A2b,C3c           = 41,45,48  # F chord
G2,B2,D3             = 43,47,50  # G chord

# --- Event builders ---

def melody_events(notes, ch=0, vel=90, gap=8):
    """
    notes: [(pitch, ticks) | (None, ticks), ...]
    None = rest
    gap:  ticks of silence between notes (articulation)
    """
    evts   = []
    pending = 0  # accumulated delta for rests / gaps
    for pitch, dur in notes:
        if pitch is None:
            pending += dur
        else:
            evts.append(var_len(pending) + bytes([0x90 | ch, pitch, vel]))
            pending = 0
            evts.append(var_len(dur - gap) + bytes([0x80 | ch, pitch, 0]))
            pending = gap
    return evts

def chord_events(chords, ch=1, vel=52, gap=8):
    """
    chords: [([pitches], ticks), ...]
    All pitches in a chord start/end simultaneously.
    """
    evts    = []
    pending = 0
    for pitches, dur in chords:
        # Note-on for all chord tones
        evts.append(var_len(pending) + bytes([0x90 | ch, pitches[0], vel]))
        for p in pitches[1:]:
            evts.append(b'\x00' + bytes([0x90 | ch, p, vel]))
        pending = 0
        # Note-off for all chord tones
        evts.append(var_len(dur - gap) + bytes([0x80 | ch, pitches[0], 0]))
        for p in pitches[1:]:
            evts.append(b'\x00' + bytes([0x80 | ch, p, 0]))
        pending = gap
    return evts

# --- Meta events ---

TEMPO   = b'\x00\xff\x51\x03' + struct.pack('>I', int(60_000_000 / BPM))[1:]
TIME_SIG = b'\x00\xff\x58\x04\x04\x02\x18\x08'  # 4/4
EOT     = b'\x00\xff\x2f\x00'

# --- Chord progression (fixed, same for Before & After) ---

CHORDS = [
    ([C3,  E3,  G3],  W),   # C
    ([A2,  C3b, E3b], W),   # Am
    ([F2,  A2b, C3c], W),   # F
    ([G2,  B2,  D3],  W),   # G
]

# --- BEFORE melody ---
# 音域: C4〜E4  /  全て4分音符  /  方向感なし

BEFORE = [
    # measure 1 | C
    (E4,Q),(E4,Q),(D4,Q),(E4,Q),
    # measure 2 | Am
    (E4,Q),(D4,Q),(C4,Q),(D4,Q),
    # measure 3 | F
    (D4,Q),(E4,Q),(D4,Q),(C4,Q),
    # measure 4 | G
    (D4,Q),(E4,Q),(D4,Q),(None,Q),
]

# --- AFTER melody ---
# 音域: C4〜B4  /  8分音符混在  /  山型（3小節目がクライマックス）

AFTER = [
    # measure 1 | C  ← 上昇スタート
    (C4,E),(D4,E),(E4,Q),(G4,Q),(A4,Q),
    # measure 2 | Am
    (A4,Q),(G4,E),(E4,E),(F4,Q),(E4,Q),
    # measure 3 | F  ← B4 が最高音（クライマックス）
    (F4,E),(G4,E),(A4,Q),(B4,Q),(A4,Q),
    # measure 4 | G  ← C4 へ下降・解決
    (G4,Q),(F4,E),(E4,E),(D4,Q),(C4,Q),
]

# --- Save MIDI ---

def save_midi(mel, crd, path):
    t0 = make_track([TEMPO, TIME_SIG, EOT])             # tempo track
    t1 = make_track(melody_events(mel) + [EOT])         # melody  (ch 0)
    t2 = make_track(chord_events(crd)  + [EOT])         # chords  (ch 1)
    data = make_header(1, 3, TPB) + t0 + t1 + t2
    with open(path, 'wb') as f:
        f.write(data)
    print(f"  saved → {path}  ({len(data)} bytes)")

out = os.path.dirname(os.path.abspath(__file__))
print("Generating MIDI files...")
save_midi(BEFORE, CHORDS, os.path.join(out, '01_before.mid'))
save_midi(AFTER,  CHORDS, os.path.join(out, '01_after.mid'))
print("Done!")
