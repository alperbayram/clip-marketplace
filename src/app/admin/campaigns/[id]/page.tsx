"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyViewsChart } from "@/components/daily-views-chart";
import { ReviewQueue } from "@/components/review-queue";
import { ApprovedSubmissions } from "@/components/approved-submissions";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = trpc.campaign.overview.useQuery({
    campaignId: id,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Campaign not found.</p>;
  }

  const {
    campaign,
    totalApprovedViews,
    budgetSpentCents,
    budgetLeftCents,
    isOverBudget,
    dailySeries,
  } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{campaign.title}</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.startsAt} → {campaign.endsAt}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {campaign.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/campaigns/${id}/edit`} />}
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Approved views"
          value={totalApprovedViews.toLocaleString()}
        />
        <StatCard
          label="Budget spent"
          value={`$${(budgetSpentCents / 100).toFixed(2)}`}
        />
        <StatCard
          label="Budget left"
          value={`$${(budgetLeftCents / 100).toFixed(2)}`}
        />
        <StatCard
          label="Total budget"
          value={`$${(campaign.totalBudgetCents / 100).toFixed(2)}`}
        />
      </div>

      {isOverBudget && (
        <p className="text-sm text-destructive">
          Spend has grown past the budget from view growth after approval — no
          further submissions can be approved on this campaign.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daily views</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyViewsChart data={dailySeries} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-medium">Review queue</h2>
        <ReviewQueue campaignId={id} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Approved submissions</h2>
        <ApprovedSubmissions campaignId={id} />
      </div>
    </div>
  );
}
