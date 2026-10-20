import { PageHeader } from "@/components/page-header";
import { activeProvider } from "@/lib/ai";
import { RecommendForm } from "./recommend-form";

export const metadata = { title: "おすすめ案件を提案 | Affiliate Pilot AI" };

export default async function RecommendPage() {
  const ai = await activeProvider();
  return (
    <>
      <PageHeader title="サイト・SNSからおすすめ案件を提案" description="URL（ブログ・YouTube・Instagram・X など）や投稿のテキストから、ジャンルを判定して「合う案件の種類・探すASP・訴求の切り口」を提案します。SNSの自動取得・スクレイピングは行いません。" />
      <RecommendForm aiAvailable={ai.provider !== "fallback"} />
    </>
  );
}
