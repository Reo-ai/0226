import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  spring,
  staticFile,
} from 'remotion';
import { HookText } from '../components/HookText';
import { SubtitleLine } from '../components/SubtitleLine';
import { CtaBanner } from '../components/CtaBanner';
import { ProgressBar } from '../components/ProgressBar';

/** Theme accent colors */
const THEME_COLORS: Record<string, string> = {
  fitness:     '#FF6B35',
  sleep:       '#6C63FF',
  money:       '#FFD700',
  supplements: '#4CAF50',
  skills:      '#2196F3',
};

export interface NarrationLine {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface SelfImprovementReelProps {
  theme: string;
  hook: string;
  narrationLines: NarrationLine[];
  imagePath: string;        // 絶対パス or staticFile パス
  accentColor?: string;
  ctaText?: string;
  showCta?: boolean;
}

export const SelfImprovementReel: React.FC<SelfImprovementReelProps> = ({
  theme,
  hook,
  narrationLines,
  imagePath,
  accentColor,
  ctaText = 'プロフリンクから詳しくチェック！',
  showCta = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const color = accentColor || THEME_COLORS[theme] || '#FF6B35';

  // Slow Ken Burns zoom effect on the background image
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: 'clamp',
  });

  // Fade in
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // CTA starts in the last 5 seconds
  const ctaStartFrame = durationInFrames - fps * 5;

  return (
    <AbsoluteFill style={{ background: '#000', opacity }}>

      {/* ── Background image with Ken Burns zoom ── */}
      {imagePath ? (
        <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          <Img
            src={imagePath}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Dark gradient overlay for readability */}
          <AbsoluteFill style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.85) 100%)',
          }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)` }} />
      )}

      {/* ── Hook text (first 3 seconds) ── */}
      <Sequence from={0} durationInFrames={fps * 3}>
        <HookText text={hook} color={color} />
      </Sequence>

      {/* ── Narration subtitles ── */}
      {narrationLines.map((line, i) => (
        <Sequence key={i} from={line.startFrame} durationInFrames={line.endFrame - line.startFrame}>
          <SubtitleLine text={line.text} color={color} />
        </Sequence>
      ))}

      {/* ── Progress bar ── */}
      <ProgressBar color={color} />

      {/* ── CTA Banner (last 5 seconds) ── */}
      {showCta && (
        <Sequence from={ctaStartFrame} durationInFrames={fps * 5}>
          <CtaBanner text={ctaText} color={color} />
        </Sequence>
      )}

    </AbsoluteFill>
  );
};
