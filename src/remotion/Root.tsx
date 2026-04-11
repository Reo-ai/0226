import { Composition, staticFile } from 'remotion';
import { SelfImprovementReel } from './compositions/SelfImprovementReel';
import { SubtitleReel } from './compositions/SubtitleReel';
import { Post01MorningHabits, TOTAL_FRAMES as POST01_FRAMES } from './compositions/Post01MorningHabits';

/**
 * Remotion Root — registers all video compositions.
 *
 * Render commands:
 *   # 1投稿目（成功者の朝習慣）
 *   npx remotion render src/remotion/index.tsx Post01MorningHabits output/videos/post01.mp4
 *
 *   # 汎用リール（テーマ指定）
 *   npx remotion render src/remotion/index.tsx SelfImprovementReel --props='{"theme":"fitness",...}' out.mp4
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── 投稿 #01: 成功者と普通の人の朝の違い ── */}
      <Composition
        id="Post01MorningHabits"
        component={Post01MorningHabits}
        durationInFrames={POST01_FRAMES}  // 930f = 31秒
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          // 動画背景: 自分の動画を public/video/ に入れて指定
          videoSrc: staticFile('video/sample_bg.mp4'),
          // ナレーション音声: scripts/generate-narration.js で生成後に有効化
          // audioSrc: staticFile('audio/post01_narration.mp3'),
          audioSrc: undefined,
        }}
      />

      {/* ── 汎用リール（AI画像背景 + 字幕） ── */}
      <Composition
        id="SelfImprovementReel"
        component={SelfImprovementReel}
        durationInFrames={900}
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
          imagePath: '',
          accentColor: '#FF6B35',
          ctaText: 'プロフリンクから詳しくチェック！',
          showCta: true,
        }}
      />

      {/* ── 字幕オーバーレイのみ（AI動画に重ねる用） ── */}
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
