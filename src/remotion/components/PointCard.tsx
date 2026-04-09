import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const GOLD = '#FFD700';
const RED   = '#FF4444';
const GREEN = '#44FF88';

interface PointCardProps {
  number: string;
  badLabel?: string;
  goodLabel: string;
  resultLabel?: string;
  delayFrames?: number;
  accentColor?: string;
}

/**
 * NG → OK 形式の比較カード
 */
export const PointCard: React.FC<PointCardProps> = ({
  number,
  badLabel,
  goodLabel,
  resultLabel,
  delayFrames = 0,
  accentColor = GOLD,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideX = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 14, stiffness: 140 },
    from: 80,
    to: 0,
  });

  const opacity = interpolate(frame - delayFrames, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < delayFrames) return null;

  return (
    <div style={{
      transform: `translateX(${slideX}px)`,
      opacity,
      width: '100%',
      marginBottom: 24,
    }}>
      {/* Number badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: accentColor,
        color: '#000',
        fontWeight: 900,
        fontSize: 26,
        fontFamily: '"Noto Sans JP", sans-serif',
        marginBottom: 12,
        boxShadow: `0 0 20px ${accentColor}88`,
      }}>
        {number}
      </div>

      {/* Bad label */}
      {badLabel && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: RED }}>❌</span>
          <span style={{
            color: '#aaa',
            fontSize: 34,
            fontFamily: '"Noto Sans JP", sans-serif',
            fontWeight: 700,
            textDecoration: 'line-through',
            textDecorationColor: RED,
          }}>
            {badLabel}
          </span>
        </div>
      )}

      {/* Good label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: resultLabel ? 10 : 0,
      }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: GREEN }}>✅</span>
        <span style={{
          color: '#fff',
          fontSize: 38,
          fontFamily: '"Noto Sans JP", sans-serif',
          fontWeight: 900,
        }}>
          {goodLabel}
        </span>
      </div>

      {/* Result badge */}
      {resultLabel && (
        <div style={{
          display: 'inline-block',
          background: `${accentColor}22`,
          border: `2px solid ${accentColor}`,
          borderRadius: 8,
          padding: '6px 16px',
          color: accentColor,
          fontSize: 28,
          fontWeight: 700,
          fontFamily: '"Noto Sans JP", sans-serif',
          marginTop: 4,
          marginLeft: 44,
        }}>
          → {resultLabel}
        </div>
      )}
    </div>
  );
};

/**
 * コンパクトなOKカード（2個横並び用）
 */
export const CompactPointCard: React.FC<{
  icon: string;
  label: string;
  sublabel?: string;
  delayFrames?: number;
  accentColor?: string;
}> = ({ icon, label, sublabel, delayFrames = 0, accentColor = GOLD }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 12, stiffness: 160 },
    from: 0.6,
    to: 1,
  });

  const opacity = interpolate(frame - delayFrames, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < delayFrames) return null;

  return (
    <div style={{
      transform: `scale(${scale})`,
      opacity,
      background: 'rgba(255,255,255,0.06)',
      border: `2px solid ${accentColor}66`,
      borderRadius: 20,
      padding: '28px 24px',
      textAlign: 'center',
      flex: 1,
    }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{icon}</div>
      <div style={{
        color: '#fff',
        fontSize: 34,
        fontWeight: 900,
        fontFamily: '"Noto Sans JP", sans-serif',
        lineHeight: 1.3,
        marginBottom: sublabel ? 8 : 0,
      }}>
        {label}
      </div>
      {sublabel && (
        <div style={{
          color: accentColor,
          fontSize: 26,
          fontWeight: 700,
          fontFamily: '"Noto Sans JP", sans-serif',
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};
