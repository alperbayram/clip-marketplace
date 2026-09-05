import { relations } from "drizzle-orm";
import { campaigns, submissionMetrics, submissions, users } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  submissions: many(submissions),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  submissions: many(submissions),
}));

export const submissionsRelations = relations(
  submissions,
  ({ one, many }) => ({
    campaign: one(campaigns, {
      fields: [submissions.campaignId],
      references: [campaigns.id],
    }),
    creator: one(users, {
      fields: [submissions.creatorId],
      references: [users.id],
    }),
    metrics: many(submissionMetrics),
  }),
);

export const submissionMetricsRelations = relations(
  submissionMetrics,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionMetrics.submissionId],
      references: [submissions.id],
    }),
  }),
);
