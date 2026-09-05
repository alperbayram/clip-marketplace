"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MySubmissionsPage() {
  const { data: submissions, isLoading } = trpc.submission.myList.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My submissions</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !submissions || submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t submitted any clips yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Post URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Estimated earnings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.campaignTitle}</TableCell>
                <TableCell className="max-w-xs truncate">
                  <a
                    href={s.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {s.postUrl}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={s.status === "rejected" ? "destructive" : "secondary"}
                    className="capitalize"
                  >
                    {s.status}
                  </Badge>
                  {s.status === "rejected" && s.rejectionReason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.rejectionReason}
                    </p>
                  )}
                </TableCell>
                <TableCell>{s.currentViews.toLocaleString()}</TableCell>
                <TableCell>
                  ${(s.estimatedEarningsCents / 100).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
