"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BrowseCampaignsPage() {
  const { data: campaigns, isLoading } = trpc.campaign.browseActive.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Active campaigns</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !campaigns || campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active campaigns right now — check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{campaign.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {campaign.platforms.map((p) => (
                      <Badge key={p} variant="secondary" className="capitalize">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ${(campaign.payoutPerKViewsCents / 100).toFixed(2)} per
                    1,000 views
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Runs {campaign.startsAt} → {campaign.endsAt}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
