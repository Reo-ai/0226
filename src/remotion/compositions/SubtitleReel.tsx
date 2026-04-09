import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { SubtitleLine } from '../components/SubtitleLine';
import { CtaBanner } from '../components/CtaBanner';

/**
 * SubtitleReel — transparent overlay composition.
 * Use this when you already have an AI-generated video (Sora/Kling)
 * and want to add subtitles and CTA on top.
 *
 * Render with alpha channel:
 *   npx remotion render ... --codec=vp8 (WebM with alpha)
 * Then composite over your video in CapCut or ffmpeg.
 */

export interface Subtitle {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface SubtitleReelProps {
  subtitles: Subtitle[];
  accentColor?: string;
  ctaText?: string;
  ctaStartFrame?: number;
}

export const SubtitleReel: React.FC<SubtitleReelProps> = ({
  subtitles,
  accentColor = '#FF6B35',
  ctaText = 'プロフリンクから詳しくチェック！',
  ctaStartFrame,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const ctaStart = ctaStartFrame ?? durationInFrames - fps * 5;

  return (
    <AbsoluteFill style={{ background: 'transparent' }}>

      {subtitles.map((sub, i) => (
        <Sequence key={i} from={sub.startFrame} durationInFrames={sub.endFrame - sub.startFrame}>
          <SubtitleLine text={sub.text} color={accentColor} />
        </Sequence>
      ))}

      <Sequence from={ctaStart} durationInFrames={fps * 5}>
        <CtaBanner text={ctaText} color={accentColor} />
      </Sequence>

    </AbsoluteFill>
  );
};
