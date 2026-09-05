"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CampaignForm } from "@/components/campaign-form";

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: campaign, isLoading } = trpc.campaign.getById.useQuery({ id });
  const update = trpc.campaign.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.campaign.adminList.invalidate(),
        utils.campaign.getById.invalidate({ id }),
        utils.campaign.overview.invalidate({ campaignId: id }),
      ]);
      toast.success("Campaign updated");
      router.push(`/admin/campaigns/${id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!campaign) {
    return <p className="text-sm text-muted-foreground">Campaign not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit campaign</h1>
      <CampaignForm
        defaultValues={{
          title: campaign.title,
          platforms: campaign.platforms,
          payoutPerKViewsCents: campaign.payoutPerKViewsCents,
          totalBudgetCents: campaign.totalBudgetCents,
          status: campaign.status,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
        }}
        submitLabel="Save changes"
        isSubmitting={update.isPending}
        onSubmit={(values) => update.mutate({ id, data: values })}
      />
    </div>
  );
}
