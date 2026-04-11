import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CtaBanner } from '../components/CtaBanner';
import { ProgressBar } from '../components/ProgressBar';

// ── テーマカラー ──────────────────────────────────────────────
const GOLD   = '#FFD700';
const ORANGE = '#FF6B35';

// ── 字幕データ ────────────────────────────────────────────────
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

// ── キーワードオーバーレイ（喋りに合わせてポップアップ）──────
const KEYWORDS = [
  { text: '📵 スマホを見ない',        start: 90,  end: 330,  color: '#FF4444' },
  { text: '✅ 5分 マインドセット',     start: 330, end: 510,  color: GOLD      },
  { text: '🏋️ 朝10分 運動',           start: 510, end: 690,  color: GOLD      },
  { text: '💧 水 500ml',              start: 690, end: 840,  color: '#4FC3F7' },
  { text: '🔥 成功者は例外なく継続',  start: 930, end: 1110, color: ORANGE    },
];

const TOTAL_FRAMES = 1260; // 42秒

// ─────────────────────────────────────────────────────────────
export const Post01MorningHabits: React.FC<{
  audioSrc?: string;
  videoSrc?: string;
}> = ({ audioSrc, videoSrc }) => {
  const frame = useCurrentFrame();

  const currentSub     = SUBTITLES.find(s => frame >= s.start && frame < s.end);
  const currentKeyword = KEYWORDS.find(k => frame >= k.start && frame < k.end);

  const globalOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: '#0A0A0A',
      opacity: globalOpacity,
      fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
    }}>

      {/* ── 音声 ────────────────────────────────────────── */}
      {audioSrc && <Audio src={audioSrc} />}

      {/* ── 背景動画（人物など）─────────────────────────── */}
      {videoSrc ? (
        <OffthreadVideo
          src={videoSrc}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        // 動画がない場合のプレースホルダー背景
        <PlaceholderBg frame={frame} />
      )}

      {/* ── 暗めのオーバーレイ（テキストを読みやすくする）── */}
      <AbsoluteFill style={{ background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />

      {/* ── フック（冒頭3秒）──────────────────────────────── */}
      <Sequence from={0} durationInFrames={90}>
        <HookOverlay />
      </Sequence>

      {/* ── キーワードポップアップ ────────────────────────── */}
      {currentKeyword && (
        <KeywordBadge
          text={currentKeyword.text}
          color={currentKeyword.color}
          startFrame={currentKeyword.start}
        />
      )}

      {/* ── 字幕 ─────────────────────────────────────────── */}
      {currentSub && (
        <SubtitleOverlay
          text={currentSub.text}
          startFrame={currentSub.start}
          endFrame={currentSub.end}
        />
      )}

      {/* ── CTA（最後5秒）────────────────────────────────── */}
      <Sequence from={1110} durationInFrames={150}>
        <CtaBanner
          text="👆 フォローで毎日こういう情報流すから"
          color={GOLD}
        />
      </Sequence>

      {/* ── プログレスバー ─────────────────────────────────── */}
      <ProgressBar color={GOLD} />

      {/* ── アカウントバッジ ───────────────────────────────── */}
      <AccountBadge />

    </AbsoluteFill>
  );
};

// ── 動画なし時のプレースホルダー背景 ─────────────────────────
const PlaceholderBg: React.FC<{ frame: number }> = ({ frame }) => {
  const glowOpacity = interpolate(
    frame % 90, [0, 45, 90], [0.15, 0.3, 0.15],
    { extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ background: '#0d1117' }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '-20%',
        width: '80%', height: '80%', borderRadius: '50%',
        background: `radial-gradient(circle, ${GOLD}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        filter: 'blur(80px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-20%',
        width: '70%', height: '70%', borderRadius: '50%',
        background: `radial-gradient(circle, ${ORANGE}33 0%, transparent 70%)`,
        filter: 'blur(80px)',
      }} />
      {/* シルエット的な人型の枠（動画プレースホルダー） */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: 260, height: 260, borderRadius: '50%',
          background: 'rgba(255,215,0,0.06)',
          border: '2px dashed rgba(255,215,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 64 }}>🎥</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: 700 }}>
            動画をここに配置
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── フックオーバーレイ（冒頭3秒）────────────────────────────
const HookOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 }, from: 0.8, to: 1 });
  const opacity = interpolate(frame, [0, 10, 75, 90], [0, 1, 1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 48px' }}>
      <div style={{ transform: `scale(${scale})`, opacity, textAlign: 'center' }}>
        <div style={{
          color: GOLD,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '0.15em',
          marginBottom: 12,
          textShadow: `0 0 20px ${GOLD}88`,
        }}>
          成功の哲学
        </div>
        <div style={{
          color: '#fff',
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1.3,
          textShadow: '0 4px 32px rgba(0,0,0,0.8)',
          marginBottom: 20,
        }}>
          成功者と普通の人の<br />
          <span style={{ color: GOLD }}>朝の違い</span>
        </div>
        <div style={{
          display: 'inline-block',
          background: GOLD,
          color: '#000',
          fontSize: 36,
          fontWeight: 900,
          padding: '8px 32px',
          borderRadius: 50,
        }}>
          たった 3 つ
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── キーワードバッジ（画面上部にポップアップ）───────────────
const KeywordBadge: React.FC<{ text: string; color: string; startFrame: number }> = ({ text, color, startFrame }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - startFrame;

  const opacity = interpolate(elapsed, [0, 8, 50, 60], [0, 1, 1, 0.85], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });
  const translateY = interpolate(elapsed, [0, 8], [-20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 100 }}>
      <div style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        background: 'rgba(0,0,0,0.75)',
        border: `2px solid ${color}`,
        borderRadius: 50,
        padding: '10px 28px',
        color,
        fontSize: 34,
        fontWeight: 900,
        letterSpacing: '0.05em',
        backdropFilter: 'blur(8px)',
      }}>
        {text}
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
        background: 'rgba(0,0,0,0.82)',
        borderRadius: 12,
        padding: '16px 22px',
        color: '#fff',
        fontSize: 38,
        fontWeight: 700,
        textAlign: 'center',
        borderLeft: `4px solid ${GOLD}`,
        maxWidth: '100%',
        lineHeight: 1.5,
        backdropFilter: 'blur(4px)',
      }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ── アカウントバッジ ──────────────────────────────────────────
const AccountBadge: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', padding: '0 28px 48px 0' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(0,0,0,0.65)',
      border: `1px solid ${GOLD}66`,
      borderRadius: 50,
      padding: '8px 16px 8px 12px',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
      }} />
      <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>
        @seiko_no_tetsugaku
      </span>
    </div>
  </AbsoluteFill>
);

export { TOTAL_FRAMES };
