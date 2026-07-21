// Makes staging a faithful mirror of production, so staging testing
// accurately predicts production behavior. Run this on-demand right
// before any testing session where you want production-fresh data -
// there is no continuous/live sync (deliberately: this app's collections
// are small - low thousands of docs at most - so a fast on-demand re-sync
// is far simpler than building and maintaining real replication).
//
// For every collection in production: drops the same-named staging
// collection (if present) and copies every document across at the raw
// driver level (no Mongoose schema/casting involved, so legacy-shaped
// documents survive unchanged), then recreates indexes from the
// production collection so uniqueness constraints etc. carry over too.
// Staging-only collections not present in production are dropped, since
// "consistent with production" means staging shouldn't have anything
// production doesn't.
//
// Afterward, staging-only test fixtures (e.g. the disposable
// dispatcher.test@meitu.internal account) will be gone - re-seed them
// with seed-test-dispatcher.js / seed-test-dispatcher-stock.js if needed.
//
// Usage:
//   node src/scripts/sync-staging-from-production.js --dry-run
//   node src/scripts/sync-staging-from-production.js --apply
//
// Reads .env (production) and .env.staging directly and in isolation
// (dotenv.parse, never touching process.env) - it does not matter which
// env DOTENV_CONFIG_PATH points a wrapping process at, and the two URIs
// can never be confused with each other.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, "../..");

function loadEnvFile(filename) {
  const filePath = path.join(serverRoot, filename);
  return dotenv.parse(fs.readFileSync(filePath, "utf-8"));
}

const prodEnv = loadEnvFile(".env");
const stagingEnv = loadEnvFile(".env.staging");

const SOURCE_URI = prodEnv.MONGODB_URI || prodEnv.MONGO_URI;
const TARGET_URI = stagingEnv.MONGODB_URI || stagingEnv.MONGO_URI;

if (!SOURCE_URI) throw new Error("Missing MONGO_URI in .env (production)");
if (!TARGET_URI) throw new Error("Missing MONGO_URI in .env.staging");

// Hard safety guard, checked by literal cluster hostname rather than the
// shared dbWriteSafety.js helper: that helper infers "is this production"
// from DB_ENV/NODE_ENV or a "prod"-like token in the host/db name, and
// this repo's own production .env sets neither (host is just
// cluster0.wbdntjm.mongodb.net, db is just "meituweb") - it would
// silently say "not production" here. Never proceed on a guess.
if (!/wbdntjm/.test(SOURCE_URI)) {
  throw new Error(`Refusing to run: source URI doesn't look like the known production cluster: ${SOURCE_URI}`);
}
if (!/tpeskb7/.test(TARGET_URI)) {
  throw new Error(`Refusing to run: target URI doesn't look like the known staging cluster: ${TARGET_URI}`);
}
if (SOURCE_URI === TARGET_URI) {
  throw new Error("Refusing to run: source and target URIs are identical");
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";

  console.log(`[${mode}]`);
  console.log("Source (production):", SOURCE_URI.replace(/:[^:@]*@/, ":****@"));
  console.log("Target (staging):   ", TARGET_URI.replace(/:[^:@]*@/, ":****@"));
  if (mode === "dry-run") {
    console.log("Dry run - no writes will be performed. Re-run with --apply to write.\n");
  } else {
    console.log("*** APPLY MODE - this WILL drop and overwrite every staging collection. ***\n");
  }

  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
  const targetConn = await mongoose.createConnection(TARGET_URI).asPromise();

  const sourceCollections = (await sourceConn.db.listCollections().toArray()).map((c) => c.name).sort();
  const targetCollections = (await targetConn.db.listCollections().toArray()).map((c) => c.name).sort();

  const staleTargetOnly = targetCollections.filter((name) => !sourceCollections.includes(name));

  console.log(`Production has ${sourceCollections.length} collections. Staging currently has ${targetCollections.length}.`);
  if (staleTargetOnly.length) {
    console.log(`Staging-only collections that ${mode === "apply" ? "will be" : "would be"} dropped entirely: ${staleTargetOnly.join(", ")}`);
  }
  console.log();

  if (mode === "apply") {
    for (const name of staleTargetOnly) {
      await targetConn.db.collection(name).drop();
      console.log(`Dropped staging-only collection: ${name}`);
    }
  }

  const BATCH_SIZE = 500;
  let grandTotal = 0;

  for (const name of sourceCollections) {
    const sourceCol = sourceConn.db.collection(name);
    const total = await sourceCol.countDocuments();

    if (mode === "dry-run") {
      console.log(`${name.padEnd(35)} would copy ${total} docs`);
      grandTotal += total;
      continue;
    }

    const targetCol = targetConn.db.collection(name);
    if (targetCollections.includes(name)) {
      await targetCol.drop();
    }

    let copied = 0;
    if (total > 0) {
      const cursor = sourceCol.find({});
      let batch = [];
      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= BATCH_SIZE) {
          await targetCol.insertMany(batch, { ordered: true });
          copied += batch.length;
          batch = [];
        }
      }
      if (batch.length) {
        await targetCol.insertMany(batch, { ordered: true });
        copied += batch.length;
      }
    } else {
      // Ensure an empty collection still exists (matches production's shape).
      await targetConn.db.createCollection(name);
    }

    // Recreate indexes from the source (skip the implicit _id index, which
    // every collection already has).
    const sourceIndexes = await sourceCol.indexes();
    const customIndexes = sourceIndexes.filter((idx) => idx.name !== "_id_");
    if (customIndexes.length) {
      const specs = customIndexes.map(({ key, name: indexName, ...options }) => ({
        key,
        name: indexName,
        ...options,
      }));
      await targetCol.createIndexes(specs);
    }

    grandTotal += copied;
    console.log(`${name.padEnd(35)} copied ${copied}/${total} docs, ${customIndexes.length} index(es)`);
  }

  if (mode === "dry-run") {
    console.log(`\nWould copy ${grandTotal} total documents across ${sourceCollections.length} collections.`);
    console.log("Dry run complete - no writes performed. Re-run with --apply to write.");
  } else {
    console.log(`\nDone. ${grandTotal} total documents copied across ${sourceCollections.length} collections.`);
    console.log("If you rely on staging-only test fixtures, re-seed them now (e.g. seed-test-dispatcher.js / seed-test-dispatcher-stock.js).");
  }

  await sourceConn.close();
  await targetConn.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
