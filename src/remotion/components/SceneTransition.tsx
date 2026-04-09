import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

/**
 * シーン間のトランジション（スライドワイプ）
 */
export const SlideTransition: React.FC<{
  direction?: 'up' | 'left';
  color?: string;
}> = ({ direction = 'up', color = '#000' }) => {
  const frame = useCurrentFrame();

  const translate = interpolate(frame, [0, 8], [0, direction === 'up' ? -1280 : -720], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: color,
        transform: direction === 'up'
          ? `translateY(${translate}px)`
          : `translateX(${translate}px)`,
        zIndex: 100,
      }}
    />
  );
};

/**
 * フェードイン/アウト用ラッパー
 */
export const FadeIn: React.FC<{
  children: React.ReactNode;
  durationFrames?: number;
  delayFrames?: number;
}> = ({ children, durationFrames = 12, delayFrames = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [delayFrames, delayFrames + durationFrames],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  return <div style={{ opacity }}>{children}</div>;
};
