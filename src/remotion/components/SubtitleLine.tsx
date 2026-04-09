import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

/**
 * SubtitleLine — ナレーション字幕。
 * 画面下部に表示。フェードイン／アウトあり。
 */
export const SubtitleLine: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, 8, /* ... */ 999 - 8, 999],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  const translateY = interpolate(frame, [0, 8], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 120,
      paddingLeft: 30,
      paddingRight: 30,
    }}>
      <div style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        background: 'rgba(0, 0, 0, 0.72)',
        borderLeft: `5px solid ${color}`,
        borderRadius: 10,
        padding: '18px 24px',
        textAlign: 'center',
        color: '#FFFFFF',
        fontSize: 46,
        fontWeight: 700,
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
        lineHeight: 1.5,
        maxWidth: '100%',
        boxShadow: `0 4px 30px rgba(0,0,0,0.5)`,
        backdropFilter: 'blur(4px)',
      }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};
