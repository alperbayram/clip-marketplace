import { db } from "@/server/db";
import { campaigns, submissions, users } from "@/server/db/schema";

async function main() {
  console.log("Seeding demo data...");

  const [admin] = await db
    .insert(users)
    .values({ email: "admin@clipmarket.dev", role: "admin" })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const [creatorAlice] = await db
    .insert(users)
    .values({ email: "alice@clipmarket.dev", role: "creator" })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const [creatorBob] = await db
    .insert(users)
    .values({ email: "bob@clipmarket.dev", role: "creator" })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (!admin || !creatorAlice || !creatorBob) {
    console.log("Demo users already exist, skipping campaign/submission seed.");
    return;
  }

  const today = new Date();
  const startsAt = new Date(today);
  startsAt.setDate(startsAt.getDate() - 7);
  const endsAt = new Date(today);
  endsAt.setDate(endsAt.getDate() + 23);
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);

  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: "Summer Launch Clips",
      platforms: ["tiktok", "youtube"],
      payoutPerKViewsCents: 50,
      totalBudgetCents: 500_00,
      status: "active",
      startsAt: toDateString(startsAt),
      endsAt: toDateString(endsAt),
    })
    .returning();

  if (campaign) {
    await db.insert(submissions).values({
      campaignId: campaign.id,
      creatorId: creatorAlice.id,
      postUrl: "https://www.tiktok.com/@alice/video/7123456789012345678",
      platform: "tiktok",
      status: "pending",
    });
  }

  console.log("Seed complete:");
  console.log(`  admin:   ${admin.email}`);
  console.log(`  creator: ${creatorAlice.email}`);
  console.log(`  creator: ${creatorBob.email}`);
  if (campaign) console.log(`  campaign: ${campaign.title} (${campaign.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
