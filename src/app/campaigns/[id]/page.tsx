"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc/client";
import { submissionCreateSchema } from "@/shared/validators/submission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const submitFormSchema = submissionCreateSchema.pick({ postUrl: true });
type SubmitFormValues = { postUrl: string };

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading } = trpc.campaign.getActiveById.useQuery({
    id,
  });
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubmitFormValues>({
    resolver: zodResolver(submitFormSchema),
  });

  const submit = trpc.submission.create.useMutation({
    onSuccess: async () => {
      toast.success("Clip submitted for review");
      reset();
      await utils.submission.myList.invalidate();
    },
    onError: (err) => {
      const code = err.data?.appErrorCode;
      if (code === "DUPLICATE_SUBMISSION") {
        toast.error("You've already submitted this URL to this campaign.");
      } else if (code === "PLATFORM_NOT_ALLOWED") {
        toast.error("This campaign doesn't accept that platform.");
      } else if (code === "INVALID_SUBMISSION_URL") {
        toast.error("That doesn't look like a real post URL.");
      } else {
        toast.error(err.message);
      }
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!campaign) {
    return (
      <p className="text-sm text-muted-foreground">
        Campaign not found or no longer active.
      </p>
    );
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{campaign.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1">
          {campaign.platforms.map((p) => (
            <Badge key={p} variant="secondary" className="capitalize">
              {p}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          ${(campaign.payoutPerKViewsCents / 100).toFixed(2)} per 1,000 views
          · Runs {campaign.startsAt} → {campaign.endsAt}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit a clip</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) =>
              submit.mutate({ campaignId: id, postUrl: values.postUrl }),
            )}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="postUrl">Post URL</Label>
              <Input
                id="postUrl"
                placeholder="https://www.tiktok.com/@you/video/..."
                {...register("postUrl")}
                aria-invalid={!!errors.postUrl}
              />
              {errors.postUrl && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.postUrl.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={submit.isPending}>
              Submit clip
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
