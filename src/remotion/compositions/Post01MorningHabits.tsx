import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { PointCard, CompactPointCard } from '../components/PointCard';
import { CtaBanner } from '../components/CtaBanner';
import { ProgressBar } from '../components/ProgressBar';
import { FadeIn } from '../components/SceneTransition';

// ── テーマカラー ──────────────────────────────────────────────
const GOLD   = '#FFD700';
const ORANGE = '#FF6B35';
const BG     = '#0A0A0A';

// ── パーティクル定義（疑似乱数で固定配置）───────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id:      i,
  x:       (i * 37 + 13) % 100,          // X位置 (%)
  size:    2 + (i % 3),                   // 2〜4px
  speed:   0.25 + (i % 5) * 0.08,        // 上昇速度
  opacity: 0.15 + (i % 4) * 0.07,        // 透明度
  delay:   (i * 11) % 80,                // 出現ずらし（フレーム）
}));

// ── 字幕データ（ナレーションに合わせた表示タイミング）─────────
const SUBTITLES = [
  { text: '成功者と普通の人の朝、何が違うか知ってる？',         start: 0,    end: 90   },
  { text: '一つ目。起きてすぐスマホを見ない。',                 start: 90,   end: 180  },
  { text: 'スマホを見た瞬間、他人のペースで一日が始まる。',     start: 180,  end: 330  },
  { text: '5分間「今日やること」を頭の中で整理する。',          start: 330,  end: 450  },
  { text: 'これだけで集中力が全然変わる。',                     start: 450,  end: 510  },
  { text: '二つ目。必ず体を動かす。10分で十分。',               start: 510,  end: 600  },
  { text: '朝の運動で脳の覚醒スイッチが入る。',                 start: 600,  end: 690  },
  { text: '三つ目。起きてすぐ水を500ml飲む。',                  start: 690,  end: 780  },
  { text: '頭のもやがスッと消える。',                           start: 780,  end: 840  },
  { text: 'この3つ、めちゃくちゃ地味でしょ？',                  start: 840,  end: 930  },
  { text: '成功者って例外なくこういう地味なことを続けてる。',   start: 930,  end: 1050 },
  { text: '習慣が積み重なると1年後が別人になってる。',          start: 1050, end: 1140 },
  { text: '成功の哲学って、結局これなんです。',                 start: 1140, end: 1200 },
  { text: '明日の朝から一個だけ試してみて。',                   start: 1200, end: 1260 },
];

// ── シーン境界（フレーム）────────────────────────────────────
const S = {
  hook:       { from: 0,    to: 90   }, // 0〜3s
  point1:     { from: 90,   to: 510  }, // 3〜17s
  point23:    { from: 510,  to: 840  }, // 17〜28s
  philosophy: { from: 840,  to: 1110 }, // 28〜37s
  cta:        { from: 1110, to: 1260 }, // 37〜42s
};

const TOTAL_FRAMES = 1260; // 42秒

// ─────────────────────────────────────────────────────────────
export const Post01MorningHabits: React.FC<{ audioSrc?: string }> = ({ audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 現在表示すべき字幕
  const currentSub = SUBTITLES.find(s => frame >= s.start && frame < s.end);

  // 全体フェードイン
  const globalOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: BG, opacity: globalOpacity, fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}>

      {/* ── ナレーション音声 ──────────────────────────── */}
      {audioSrc && <Audio src={audioSrc} />}

      {/* ── 背景グラデーション ────────────────────────── */}
      <BackgroundGlow frame={frame} />

      {/* ── 浮遊パーティクル（全シーン共通）────────────── */}
      <Particles frame={frame} />

      {/* ── Scene 1: HOOK ────────────────────────────── */}
      <Sequence from={S.hook.from} durationInFrames={S.hook.to - S.hook.from}>
        <HookScene />
      </Sequence>

      {/* ── Scene 2: POINT 1（スマホ背景アイコン）─────── */}
      <Sequence from={S.point1.from} durationInFrames={S.point1.to - S.point1.from}>
        <SceneBgIcon icon="📵" />
        <Point1Scene />
      </Sequence>

      {/* ── Scene 3: POINT 2 & 3（運動・水 背景アイコン）*/}
      <Sequence from={S.point23.from} durationInFrames={S.point23.to - S.point23.from}>
        <SceneBgIcon icon="⚡" />
        <Point23Scene />
      </Sequence>

      {/* ── Scene 4: PHILOSOPHY（デイカウンター付き）──── */}
      <Sequence from={S.philosophy.from} durationInFrames={S.philosophy.to - S.philosophy.from}>
        <SceneBgIcon icon="🧠" />
        <PhilosophyScene />
      </Sequence>

      {/* ── Scene 5: CTA ─────────────────────────────── */}
      <Sequence from={S.cta.from} durationInFrames={S.cta.to - S.cta.from}>
        <CtaBanner
          text="👆 フォローで毎日こういう情報流すから"
          color={GOLD}
        />
      </Sequence>

      {/* ── 字幕（全シーン共通） ──────────────────────── */}
      {currentSub && (
        <SubtitleOverlay text={currentSub.text} startFrame={currentSub.start} endFrame={currentSub.end} />
      )}

      {/* ── プログレスバー ─────────────────────────────── */}
      <ProgressBar color={GOLD} />

      {/* ── アカウント名（右下固定） ───────────────────── */}
      <AccountBadge />

    </AbsoluteFill>
  );
};

// ── 浮遊パーティクル ──────────────────────────────────────────
const Particles: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
    {PARTICLES.map(p => {
      // 画面下から上へ流れ、画面外に出たらループ
      const rawY = 105 - ((frame * p.speed + p.delay) % 115);
      const y = Math.max(-5, rawY);
      const fadeIn = interpolate(frame - p.delay, [0, 10], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <div key={p.id} style={{
          position: 'absolute',
          left:     `${p.x}%`,
          top:      `${y}%`,
          width:    p.size,
          height:   p.size,
          borderRadius: '50%',
          background: GOLD,
          opacity:  p.opacity * fadeIn,
          boxShadow: `0 0 ${p.size * 2}px ${GOLD}88`,
        }} />
      );
    })}
  </AbsoluteFill>
);

// ── シーン別 巨大背景アイコン ─────────────────────────────────
const SceneBgIcon: React.FC<{ icon: string }> = ({ icon }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25], [0, 0.06], {
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 40], [0.85, 1.0], {
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{
        fontSize:   420,
        opacity,
        transform:  `scale(${scale})`,
        filter:     'blur(6px)',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {icon}
      </div>
    </AbsoluteFill>
  );
};

// ── 背景グロー ────────────────────────────────────────────────
const BackgroundGlow: React.FC<{ frame: number }> = ({ frame }) => {
  const glowOpacity = interpolate(
    frame % 60, [0, 30, 60], [0.08, 0.18, 0.08],
    { extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-20%',
        width: '80%',
        height: '60%',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${GOLD}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-20%',
        width: '70%',
        height: '50%',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${ORANGE}22 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />
    </AbsoluteFill>
  );
};

// ── Scene 1: HOOK ──────────────────────────────────────────────
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 10, stiffness: 120 }, from: 0.7, to: 1 });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 48px' }}>
      <div style={{ transform: `scale(${scale})`, opacity, textAlign: 'center' }}>

        {/* サブタイトル */}
        <FadeIn durationFrames={20} delayFrames={5}>
          <div style={{ color: GOLD, fontSize: 32, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 16 }}>
            成功の哲学
          </div>
        </FadeIn>

        {/* メインタイトル */}
        <div style={{
          color: '#fff',
          fontSize: 72,
          fontWeight: 900,
          lineHeight: 1.25,
          textShadow: `0 0 40px ${GOLD}66`,
          marginBottom: 20,
        }}>
          成功者と普通の人の<br />
          <span style={{ color: GOLD }}>朝の違い</span>
        </div>

        {/* バッジ */}
        <FadeIn durationFrames={15} delayFrames={20}>
          <div style={{
            display: 'inline-block',
            background: GOLD,
            color: '#000',
            fontSize: 44,
            fontWeight: 900,
            padding: '10px 36px',
            borderRadius: 50,
            letterSpacing: '0.05em',
          }}>
            たった 3 つ
          </div>
        </FadeIn>

      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: POINT 1 ───────────────────────────────────────────
const Point1Scene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ padding: '80px 48px', justifyContent: 'center' }}>

      {/* セクションヘッダー */}
      <FadeIn durationFrames={12}>
        <div style={{
          color: GOLD,
          fontSize: 30,
          fontWeight: 700,
          marginBottom: 32,
          letterSpacing: '0.12em',
        }}>
          ── POINT 01 ──
        </div>
      </FadeIn>

      <PointCard
        number="01"
        badLabel="起きてすぐスマホ"
        goodLabel="5分間マインドセット"
        resultLabel="午前中の集中力が別物に"
        accentColor={GOLD}
        delayFrames={10}
      />

      {/* 補足テキスト */}
      {frame > 180 && (
        <FadeIn durationFrames={20}>
          <div style={{
            marginTop: 28,
            padding: '20px 24px',
            background: 'rgba(255,215,0,0.08)',
            borderLeft: `4px solid ${GOLD}`,
            borderRadius: 8,
            color: '#ddd',
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.6,
          }}>
            スマホを見た瞬間<br />
            <span style={{ color: '#FF4444', fontWeight: 700 }}>他人のペース</span>で一日が始まる<br />
            <br />
            今日やることを整理する<br />
            <span style={{ color: GOLD, fontWeight: 700 }}>たった5分</span>でOK
          </div>
        </FadeIn>
      )}

    </AbsoluteFill>
  );
};

// ── Scene 3: POINT 2 & 3 ──────────────────────────────────────
const Point23Scene: React.FC = () => {
  return (
    <AbsoluteFill style={{ padding: '80px 40px', justifyContent: 'center' }}>

      <FadeIn durationFrames={12}>
        <div style={{ color: GOLD, fontSize: 30, fontWeight: 700, marginBottom: 32, letterSpacing: '0.12em' }}>
          ── POINT 02 & 03 ──
        </div>
      </FadeIn>

      <div style={{ display: 'flex', gap: 20, marginBottom: 32 }}>
        <CompactPointCard
          icon="🏋️"
          label="朝10分"
          sublabel="体を動かす"
          accentColor={GOLD}
          delayFrames={8}
        />
        <CompactPointCard
          icon="💧"
          label="水500ml"
          sublabel="起床直後に飲む"
          accentColor={ORANGE}
          delayFrames={20}
        />
      </div>

      <FadeIn durationFrames={20} delayFrames={40}>
        <div style={{
          textAlign: 'center',
          padding: '20px',
          background: `linear-gradient(135deg, ${GOLD}18, ${ORANGE}18)`,
          border: `2px solid ${GOLD}44`,
          borderRadius: 16,
          color: '#fff',
          fontSize: 38,
          fontWeight: 900,
        }}>
          🧠 脳のスイッチON
        </div>
      </FadeIn>

    </AbsoluteFill>
  );
};

// ── Scene 4: PHILOSOPHY ────────────────────────────────────────
const PhilosophyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = [
    { text: 'この3つ、地味でしょ？',                    delay: 0,   gold: false },
    { text: '成功者って例外なく',                       delay: 25,  gold: false },
    { text: 'こういう地味なことを続けてる。',           delay: 50,  gold: true  },
    { text: '積み重なると…',                            delay: 90,  gold: false },
    { text: '1年後の自分が別人になってる。',            delay: 115, gold: true  },
    { text: '成功の哲学って、結局習慣なんです。',       delay: 155, gold: true  },
  ];

  // 「1日→365日」カウントアップ（delay:90〜200fで動く）
  const days = Math.round(
    interpolate(frame, [90, 200], [1, 365], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  );
  const counterOpacity = interpolate(frame, [85, 100], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 48px' }}>

      {/* デイカウンター（背景に薄く表示） */}
      <div style={{
        position: 'absolute',
        bottom: 180,
        right: 40,
        opacity: counterOpacity * 0.35,
        textAlign: 'right',
        pointerEvents: 'none',
      }}>
        <div style={{ color: GOLD, fontSize: 100, fontWeight: 900, lineHeight: 1 }}>
          {days}
        </div>
        <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, letterSpacing: '0.1em' }}>
          日目
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        {lines.map((line, i) => {
          const opacity = interpolate(frame - line.delay, [0, 12], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const translateY = interpolate(frame - line.delay, [0, 12], [20, 0], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <div key={i} style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              color: line.gold ? GOLD : '#fff',
              fontSize: line.gold ? 56 : 44,
              fontWeight: 900,
              lineHeight: 1.5,
              textShadow: line.gold ? `0 0 30px ${GOLD}88` : 'none',
              marginBottom: 8,
            }}>
              {line.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── 字幕オーバーレイ ───────────────────────────────────────────
const SubtitleOverlay: React.FC<{ text: string; startFrame: number; endFrame: number }> = ({ text, startFrame, endFrame }) => {
  const frame = useCurrentFrame();
  const elapsed  = frame - startFrame;
  const duration = endFrame - startFrame;

  const opacity = interpolate(elapsed, [0, 6, Math.max(7, duration - 6), duration], [0, 1, 1, 0], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });
  const translateY = interpolate(elapsed, [0, 6], [12, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 140, paddingLeft: 32, paddingRight: 32 }}>
      <div style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        background: 'rgba(0,0,0,0.78)',
        borderRadius: 12,
        padding: '16px 22px',
        color: '#fff',
        fontSize: 38,
        fontWeight: 700,
        textAlign: 'center',
        borderLeft: `4px solid ${GOLD}`,
        maxWidth: '100%',
        lineHeight: 1.5,
      }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ── アカウントバッジ（右下固定） ──────────────────────────────
const AccountBadge: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', padding: '0 28px 48px 0' }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(0,0,0,0.6)',
      border: `1px solid ${GOLD}66`,
      borderRadius: 50,
      padding: '8px 16px 8px 12px',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
      }} />
      <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>
        @seiko_no_tetsugaku
      </span>
    </div>
  </AbsoluteFill>
);

export { TOTAL_FRAMES };
