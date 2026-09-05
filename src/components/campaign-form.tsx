"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  campaignFormSchema,
  type CampaignFormValues,
} from "@/shared/validators/campaign";
import { CAMPAIGN_STATUSES, PLATFORMS } from "@/shared/validators/enums";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function CampaignForm({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: {
  defaultValues?: Partial<CampaignFormValues>;
  onSubmit: (values: CampaignFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: "",
      platforms: [],
      payoutPerKViewsCents: 0,
      totalBudgetCents: 0,
      status: "draft",
      startsAt: "",
      endsAt: "",
      ...defaultValues,
    },
  });

  const platforms = watch("platforms");
  const status = watch("status");

  function togglePlatform(
    platform: (typeof PLATFORMS)[number],
    checked: boolean,
  ) {
    const next = checked
      ? [...platforms, platform]
      : platforms.filter((p) => p !== platform);
    setValue("platforms", next, { shouldValidate: true });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-lg space-y-6"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
        {errors.title && (
          <p className="text-sm text-destructive" role="alert">
            {errors.title.message}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="flex gap-4">
          {PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="flex items-center gap-2 text-sm capitalize"
            >
              <Checkbox
                checked={platforms?.includes(platform) ?? false}
                onCheckedChange={(checked) =>
                  togglePlatform(platform, checked === true)
                }
              />
              {platform}
            </label>
          ))}
        </div>
        {errors.platforms && (
          <p className="text-sm text-destructive" role="alert">
            {errors.platforms.message}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payoutPerKViewsCents">
            Payout per 1,000 views (cents)
          </Label>
          <Input
            id="payoutPerKViewsCents"
            type="number"
            min={1}
            {...register("payoutPerKViewsCents", { valueAsNumber: true })}
            aria-invalid={!!errors.payoutPerKViewsCents}
          />
          {errors.payoutPerKViewsCents && (
            <p className="text-sm text-destructive" role="alert">
              {errors.payoutPerKViewsCents.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalBudgetCents">Total budget (cents)</Label>
          <Input
            id="totalBudgetCents"
            type="number"
            min={1}
            {...register("totalBudgetCents", { valueAsNumber: true })}
            aria-invalid={!!errors.totalBudgetCents}
          />
          {errors.totalBudgetCents && (
            <p className="text-sm text-destructive" role="alert">
              {errors.totalBudgetCents.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts at</Label>
          <Input
            id="startsAt"
            type="date"
            {...register("startsAt")}
            aria-invalid={!!errors.startsAt}
          />
          {errors.startsAt && (
            <p className="text-sm text-destructive" role="alert">
              {errors.startsAt.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Ends at</Label>
          <Input
            id="endsAt"
            type="date"
            {...register("endsAt")}
            aria-invalid={!!errors.endsAt}
          />
          {errors.endsAt && (
            <p className="text-sm text-destructive" role="alert">
              {errors.endsAt.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={status}
          onValueChange={(value) =>
            value &&
            setValue("status", value as CampaignFormValues["status"], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
