#!/usr/bin/env python3
"""
Before/After MIDI generator
#02: 音域が狭すぎる・広すぎる
BPM=140, Key=C Major, 4/4, 4 measures
Chord: C -> Am -> F -> G
"""

import struct, os

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

TPB = 480
BPM = 140
Q   = TPB
E   = TPB // 2
W   = TPB * 4

C4,D4,E4,F4,G4,A4,B4 = 60,62,64,65,67,69,71
C3,E3,G3             = 48,52,55
A2,C3b,E3b           = 45,48,52
F2,A2b,C3c           = 41,45,48
G2,B2,D3             = 43,47,50

def melody_events(notes, ch=0, vel=90, gap=8):
    evts    = []
    pending = 0
    for pitch, dur in notes:
        if pitch is None:
            pending += dur
        else:
            evts.append(var_len(pending) + bytes([0x90|ch, pitch, vel]))
            pending = 0
            evts.append(var_len(dur - gap) + bytes([0x80|ch, pitch, 0]))
            pending = gap
    return evts

def chord_events(chords, ch=1, vel=52, gap=8):
    evts    = []
    pending = 0
    for pitches, dur in chords:
        evts.append(var_len(pending) + bytes([0x90|ch, pitches[0], vel]))
        for p in pitches[1:]:
            evts.append(b'\x00' + bytes([0x90|ch, p, vel]))
        pending = 0
        evts.append(var_len(dur - gap) + bytes([0x80|ch, pitches[0], 0]))
        for p in pitches[1:]:
            evts.append(b'\x00' + bytes([0x80|ch, p, 0]))
        pending = gap
    return evts

TEMPO    = b'\x00\xff\x51\x03' + struct.pack('>I', int(60_000_000/BPM))[1:]
TIME_SIG = b'\x00\xff\x58\x04\x04\x02\x18\x08'
EOT      = b'\x00\xff\x2f\x00'

CHORDS = [
    ([C3,  E3,  G3],  W),
    ([A2,  C3b, E3b], W),
    ([F2,  A2b, C3c], W),
    ([G2,  B2,  D3],  W),
]

# BEFORE: 音域 C4〜E4（長3度、わずか3音）全て4分音符
BEFORE = [
    # measure 1 | C
    (C4,Q),(E4,Q),(D4,Q),(C4,Q),
    # measure 2 | Am
    (E4,Q),(D4,Q),(C4,Q),(D4,Q),
    # measure 3 | F
    (D4,Q),(E4,Q),(D4,Q),(C4,Q),
    # measure 4 | G
    (E4,Q),(D4,Q),(C4,Q),(None,Q),
]

# AFTER: 音域 C4〜A4（長6度、歌いやすい適切な音域）8分音符混在
AFTER = [
    # measure 1 | C  ← 上昇で始まる
    (C4,E),(E4,E),(G4,Q),(A4,Q),(G4,Q),
    # measure 2 | Am
    (A4,Q),(G4,E),(E4,E),(F4,Q),(E4,Q),
    # measure 3 | F  ← A4がピーク
    (F4,E),(G4,E),(A4,Q),(G4,Q),(F4,Q),
    # measure 4 | G  ← C4へ着地
    (G4,Q),(F4,E),(E4,E),(D4,Q),(C4,Q),
]

def save_midi(mel, crd, path):
    t0 = make_track([TEMPO, TIME_SIG, EOT])
    t1 = make_track(melody_events(mel) + [EOT])
    t2 = make_track(chord_events(crd)  + [EOT])
    data = make_header(1, 3, TPB) + t0 + t1 + t2
    with open(path, 'wb') as f:
        f.write(data)
    print(f"  saved → {path}  ({len(data)} bytes)")

out = os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)
print("Generating MIDI files...")
save_midi(BEFORE, CHORDS, os.path.join(out, '02_before.mid'))
save_midi(AFTER,  CHORDS, os.path.join(out, '02_after.mid'))
print("Done!")
