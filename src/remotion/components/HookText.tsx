import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * HookText — 冒頭3秒の大きなフックテキスト。
 * バウンスアニメーションで注目を引く。
 */
export const HookText: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
    from: 0.5,
    to: 1,
  });

  const opacity = spring({ frame, fps, from: 0, to: 1, config: { damping: 20 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 40px' }}>
      <div style={{
        transform: `scale(${scale})`,
        opacity,
        textAlign: 'center',
        color: '#FFFFFF',
        fontSize: 68,
        fontWeight: 900,
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
        lineHeight: 1.3,
        textShadow: `0 0 30px ${color}99, 0 4px 20px rgba(0,0,0,0.8)`,
        letterSpacing: '-0.02em',
        // Accent color on first character
        WebkitTextStroke: `2px ${color}`,
      }}>
        {text}
      </div>
      {/* Color accent line below text */}
      <div style={{
        position: 'absolute',
        bottom: '46%',
        width: '80%',
        height: 4,
        background: `linear-gradient(to right, transparent, ${color}, transparent)`,
        opacity: opacity * 0.8,
        transform: `scale(${scale})`,
      }} />
    </AbsoluteFill>
  );
};
