// Mirrors every collection from the production database onto staging, for
// realistic testing against real data. Source (production) is strictly
// read-only; destination (staging) collections are cleared and replaced
// 1:1 with production's documents. Collections that exist only in staging
// (e.g. crmsettings) are left untouched - this only touches collections
// that exist in production.
//
// Hard safety guardrail: the source URI must resolve to the production
// cluster host and the destination must resolve to the staging cluster
// host, or the script refuses to run - this is what prevents an accidental
// reversal (never writes to production).
//
// Usage:
//   node src/scripts/clone-production-to-staging.js
//   node src/scripts/clone-production-to-staging.js --apply
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { describeDatabaseTarget } from "../utils/dbWriteSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 1000;

function readMongoUri(envFile) {
  const filePath = path.join(__dirname, "../../", envFile);
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^MONGO_URI=(.+)$/m) || content.match(/^MONGODB_URI=(.+)$/m);
  if (!match) throw new Error(`No MONGO_URI/MONGODB_URI found in ${envFile}`);
  return match[1].trim();
}

const PRODUCTION_HOST_TOKEN = "wbdntjm";
const STAGING_HOST_TOKEN = "tpeskb7";

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";

  const sourceUri = readMongoUri(".env");
  const destUri = readMongoUri(".env.staging");

  if (!sourceUri.includes(PRODUCTION_HOST_TOKEN)) {
    throw new Error(`Refusing to run: .env's MONGO_URI does not look like the production cluster (expected host containing "${PRODUCTION_HOST_TOKEN}").`);
  }
  if (!destUri.includes(STAGING_HOST_TOKEN)) {
    throw new Error(`Refusing to run: .env.staging's MONGO_URI does not look like the staging cluster (expected host containing "${STAGING_HOST_TOKEN}").`);
  }

  console.log(`[${mode}] source (read-only): ${describeDatabaseTarget(sourceUri)}`);
  console.log(`[${mode}] destination (overwritten): ${describeDatabaseTarget(destUri)}`);

  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const destConn = await mongoose.createConnection(destUri).asPromise();

  const collections = (await sourceConn.db.listCollections().toArray())
    .map((c) => c.name)
    .sort();

  console.log(`\nCollections to mirror: ${collections.length}`);

  for (const name of collections) {
    const sourceCount = await sourceConn.db.collection(name).countDocuments();
    const destCountBefore = await destConn.db.collection(name).countDocuments();
    console.log(`  ${name}: production=${sourceCount} staging(before)=${destCountBefore}`);
  }

  if (mode !== "apply") {
    console.log("\nDry run complete - re-run with --apply to write.");
    await sourceConn.close();
    await destConn.close();
    return;
  }

  console.log("");
  for (const name of collections) {
    const destCollection = destConn.db.collection(name);
    const clearRes = await destCollection.deleteMany({});
    const docs = await sourceConn.db.collection(name).find({}).toArray();

    let inserted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      if (batch.length) {
        const res = await destCollection.insertMany(batch, { ordered: false });
        inserted += res.insertedCount || 0;
      }
    }
    console.log(`  ${name}: cleared ${clearRes.deletedCount}, inserted ${inserted}`);
  }

  console.log("\nDone. Staging now mirrors production for every production collection.");
  await sourceConn.close();
  await destConn.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
