import { db } from "@/server/db";
import { runIngest, todayISODate } from "@/server/domain/ingest";

async function main() {
  const dateStr = process.argv[2] ?? todayISODate();
  console.log(`Ingesting metrics for ${dateStr}...`);

  const summary = await runIngest(db, dateStr);

  console.log(`${summary.succeeded}/${summary.total} submissions ingested for ${dateStr}`);
  if (summary.failures.length > 0) {
    console.error(`${summary.failures.length} submission(s) failed:`);
    for (const f of summary.failures) {
      console.error(`  submission ${f.submissionId}: ${f.reason}`);
    }
  }
  for (const campaignId of summary.autoCompletedCampaignIds) {
    console.log(`  campaign ${campaignId} auto-completed (budget exhausted)`);
  }

  if (summary.failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("Ingest run failed:", err);
    process.exit(1);
  });
