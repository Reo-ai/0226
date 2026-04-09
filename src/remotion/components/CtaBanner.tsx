import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * CtaBanner — ラスト5秒に表示するアフィリエイトCTAバナー。
 * 上からスライドイン。
 */
export const CtaBanner: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideDown = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 150 },
    from: -120,
    to: 0,
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingTop: 60,
    }}>
      <div style={{
        transform: `translateY(${slideDown}px)`,
        opacity,
        background: `linear-gradient(135deg, ${color}EE, ${color}BB)`,
        borderRadius: 16,
        padding: '20px 36px',
        color: '#FFFFFF',
        fontSize: 40,
        fontWeight: 800,
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
        textAlign: 'center',
        maxWidth: '85%',
        boxShadow: `0 8px 32px ${color}66, 0 2px 8px rgba(0,0,0,0.4)`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 44 }}>👆</span>
        {text}
      </div>
    </AbsoluteFill>
  );
};
