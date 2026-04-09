import { Composition } from 'remotion';
import { SelfImprovementReel } from './compositions/SelfImprovementReel';
import { SubtitleReel } from './compositions/SubtitleReel';

/**
 * Remotion Root — registers all video compositions.
 *
 * Render with:
 *   npx remotion render src/remotion/index.tsx SelfImprovementReel --props='{"theme":"fitness",...}' out.mp4
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full self-improvement reel with image background + subtitles + CTA */}
      <Composition
        id="SelfImprovementReel"
        component={SelfImprovementReel}
        durationInFrames={900}   // 30秒 @ 30fps (変更可)
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          theme: 'fitness',
          hook: 'これを知らないと一生損する',
          narrationLines: [
            { text: 'これを知らないと一生損する', startFrame: 0,  endFrame: 90 },
            { text: '筋トレで変わった3つのこと', startFrame: 90, endFrame: 180 },
          ],
          imagePath: '',          // output/images/xxx.jpg への絶対パス
          accentColor: '#FF6B35',
          ctaText: 'プロフリンクから詳しくチェック！',
          showCta: true,
        }}
      />

      {/* Subtitle-only overlay (AI動画素材に字幕を乗せる) */}
      <Composition
        id="SubtitleReel"
        component={SubtitleReel}
        durationInFrames={900}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          subtitles: [
            { text: 'これを知らないと一生損する', startFrame: 0,  endFrame: 90 },
            { text: '筋トレで変わった3つのこと', startFrame: 90, endFrame: 180 },
          ],
          accentColor: '#FF6B35',
          ctaText: 'プロフリンクから詳しくチェック！',
          ctaStartFrame: 750,
        }}
      />
    </>
  );
};
