import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", [
  "tiktok",
  "instagram",
  "youtube",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "creator"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("creator"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    platforms: platformEnum("platforms").array().notNull(),
    payoutPerKViewsCents: integer("payout_per_k_views_cents").notNull(),
    totalBudgetCents: integer("total_budget_cents").notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    startsAt: date("starts_at", { mode: "string" }).notNull(),
    endsAt: date("ends_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_campaigns_status_created").on(table.status, table.createdAt),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    postUrl: text("post_url").notNull(),
    platform: platformEnum("platform").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("uq_submissions_campaign_post_url").on(
      table.campaignId,
      table.postUrl,
    ),
    index("idx_submissions_campaign_status").on(
      table.campaignId,
      table.status,
    ),
    index("idx_submissions_creator").on(table.creatorId),
  ],
);

export const submissionMetrics = pgTable(
  "submission_metrics",
  {
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    capturedAt: date("captured_at", { mode: "string" }).notNull(),
    views: integer("views").notNull(),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.submissionId, table.capturedAt] }),
  ],
);
