"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ApprovedSubmissions({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.submission.approvedList.useQuery({
    campaignId,
  });

  const markPaid = trpc.submission.markPaid.useMutation({
    onSuccess: async () => {
      await utils.submission.approvedList.invalidate({ campaignId });
      toast.success("Marked as paid");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No approved submissions yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Post URL</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Views</TableHead>
          <TableHead>Earnings</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id}>
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
              <Badge variant="secondary" className="capitalize">
                {s.status}
              </Badge>
            </TableCell>
            <TableCell>{s.currentViews.toLocaleString()}</TableCell>
            <TableCell>${(s.estimatedEarningsCents / 100).toFixed(2)}</TableCell>
            <TableCell className="text-right">
              {s.status === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markPaid.mutate({ submissionId: s.id })}
                  disabled={markPaid.isPending}
                >
                  Mark as paid
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
