import { PageLayout } from "@/components/layout/PageLayout";
import { AuctionDetailPage } from "./AuctionDetailPage";

export default function AuctionDetail({ params }: { params: { id: string } }) {
  return (
    <PageLayout>
      <AuctionDetailPage auctionId={BigInt(params.id)} />
    </PageLayout>
  );
}
