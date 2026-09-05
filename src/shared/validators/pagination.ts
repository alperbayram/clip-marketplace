import { z } from "zod";
import { campaignStatusSchema } from "./enums";

export const campaignListQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  status: campaignStatusSchema.optional(),
});

export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;
