import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * ProgressBar — 動画の進行を示すシンプルなプログレスバー（画面上部）。
 * 視聴継続率を高める効果がある。
 */
export const ProgressBar: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Track */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        background: 'rgba(255,255,255,0.15)',
      }} />
      {/* Fill */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${progress}%`,
        height: 6,
        background: `linear-gradient(to right, ${color}, ${color}CC)`,
        boxShadow: `0 0 8px ${color}`,
        transition: 'none',
      }} />
    </AbsoluteFill>
  );
};
