"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const { data: me, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!me) {
    return (
      <p className="text-sm text-muted-foreground">
        Pick a user from the dev sign-in switcher above to get started.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {me.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Create campaigns, review submissions, and track budget spend.
            </p>
            <Link
              href="/admin/campaigns"
              className="text-sm font-medium underline underline-offset-4"
            >
              Go to admin dashboard
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Browse campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Find active campaigns and submit a clip.
              </p>
              <Link
                href="/campaigns"
                className="text-sm font-medium underline underline-offset-4"
              >
                Browse active campaigns
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Track status, views, and estimated earnings.
              </p>
              <Link
                href="/my-submissions"
                className="text-sm font-medium underline underline-offset-4"
              >
                View my submissions
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
