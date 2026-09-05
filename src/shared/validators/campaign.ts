import { z } from "zod";
import { campaignStatusSchema, platformSchema } from "./enums";

export const campaignFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    platforms: z
      .array(platformSchema)
      .min(1, "Select at least one platform"),
    payoutPerKViewsCents: z
      .number()
      .int()
      .positive("Must be a positive amount of cents"),
    totalBudgetCents: z
      .number()
      .int()
      .positive("Must be a positive amount of cents"),
    status: campaignStatusSchema,
    startsAt: z.iso.date(),
    endsAt: z.iso.date(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End date must be after start date",
    path: ["endsAt"],
  });

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const campaignCreateSchema = campaignFormSchema;

export const campaignUpdateSchema = z.object({
  id: z.uuid(),
  data: campaignFormSchema,
});
