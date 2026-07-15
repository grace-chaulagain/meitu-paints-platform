/**
 * Removes every entity created by _tmp-seed-loadtest.js (all LOADTEST-
 * prefixed dealers, dispatchers, users, and orders). Staging only.
 *
 * Usage: DOTENV_CONFIG_PATH=.env.staging node src/scripts/_tmp-cleanup-loadtest.js
 */
import "dotenv/config";
import mongoose from "mongoose";

import User from "../models/User.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import Order from "../models/Order.model.js";
import {
  assertSafeDatabaseWrite,
  describeDatabaseTarget,
} from "../utils/dbWriteSafety.js";

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI (or MONGO_URI)");

  assertSafeDatabaseWrite({ mongoUri, operation: "cleanup load-test dealers/dispatchers/orders" });
  console.log(`[db-write] env=${process.env.NODE_ENV} ${describeDatabaseTarget(mongoUri)}`);

  await mongoose.connect(mongoUri);

  const orders = await Order.deleteMany({ orderNumber: /^LOADTEST-/ });
  const dealers = await DealerProfile.deleteMany({ email: /^loadtest-dealer-/ });
  const dispatchers = await Dispatcher.deleteMany({ email: /^loadtest-dispatcher-/ });
  const users = await User.deleteMany({ email: /^loadtest-/ });

  console.log("Deleted orders:", orders.deletedCount);
  console.log("Deleted dealers:", dealers.deletedCount);
  console.log("Deleted dispatchers:", dispatchers.deletedCount);
  console.log("Deleted users:", users.deletedCount);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error("Failed:", error.message || error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect errors during failure cleanup
    }
    process.exit(1);
  });
