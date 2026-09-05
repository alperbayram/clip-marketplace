"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CampaignForm } from "@/components/campaign-form";

export default function NewCampaignPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const create = trpc.campaign.create.useMutation({
    onSuccess: async (campaign) => {
      await utils.campaign.adminList.invalidate();
      toast.success("Campaign created");
      if (campaign) router.push(`/admin/campaigns/${campaign.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New campaign</h1>
      <CampaignForm
        submitLabel="Create campaign"
        isSubmitting={create.isPending}
        onSubmit={(values) => create.mutate(values)}
      />
    </div>
  );
}
