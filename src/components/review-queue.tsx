"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ReviewQueue({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const { data: queue, isLoading } = trpc.submission.reviewQueue.useQuery({
    campaignId,
  });

  const invalidate = () =>
    Promise.all([
      utils.submission.reviewQueue.invalidate({ campaignId }),
      utils.campaign.overview.invalidate({ campaignId }),
      utils.campaign.getById.invalidate({ id: campaignId }),
    ]);

  const approve = trpc.submission.approve.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Submission approved");
    },
    onError: (err) => {
      const code = err.data?.appErrorCode;
      if (code === "BUDGET_EXCEEDED") {
        toast.error("Approving this would exceed the campaign budget.");
      } else if (code === "CAMPAIGN_COMPLETED") {
        toast.error("This campaign is already completed.");
      } else {
        toast.error(err.message);
      }
    },
  });

  const reject = trpc.submission.reject.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Submission rejected");
    },
    onError: (err) => toast.error(err.message),
  });

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!queue || queue.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending submissions.</p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Post URL</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queue.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="max-w-xs truncate">
                <a
                  href={submission.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  {submission.postUrl}
                </a>
              </TableCell>
              <TableCell className="capitalize">{submission.platform}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(submission.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <Button
                  size="sm"
                  onClick={() => approve.mutate({ submissionId: submission.id })}
                  disabled={approve.isPending}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setRejectingId(submission.id);
                    setReason("");
                  }}
                >
                  Reject
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={rejectingId !== null}
        onOpenChange={(open) => !open && setRejectingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this submission being rejected?"
              required
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => {
                if (!rejectingId) return;
                reject.mutate(
                  { submissionId: rejectingId, reason },
                  { onSuccess: () => setRejectingId(null) },
                );
              }}
            >
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
