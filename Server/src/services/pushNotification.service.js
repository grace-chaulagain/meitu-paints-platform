import webpush from "web-push";
import User from "../models/User.model.js";
import PushSubscription from "../models/PushSubscription.model.js";
import {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
} from "../config/env.js";

let configured = false;

function vapidConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

function ensureConfigured() {
  if (configured || !vapidConfigured()) return;
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  configured = true;
}

export function getVapidPublicKey() {
  return vapidConfigured() ? VAPID_PUBLIC_KEY : null;
}

export async function saveSubscription({ userId, subscription, userAgent = "" }) {
  if (!userId || !subscription?.endpoint || !subscription?.keys) {
    throw new Error("Missing userId or subscription");
  }

  return PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: String(userAgent || "").slice(0, 300),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function removeSubscription({ endpoint }) {
  if (!endpoint) return { deletedCount: 0 };
  return PushSubscription.deleteOne({ endpoint });
}

// Best-effort - never throws, prunes subscriptions the push service has
// permanently rejected (410 Gone / 404, meaning the browser unsubscribed
// or the endpoint no longer exists) so the list doesn't grow stale.
async function sendToSubscriptions(subscriptions, payload) {
  if (!subscriptions.length) return;
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          body,
        );
      } catch (error) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.warn("[web-push] send failed:", statusCode, error?.message);
        }
      }
    }),
  );
}

export async function sendPushToRole(role, payload) {
  if (!vapidConfigured()) return;
  ensureConfigured();

  const users = await User.find({ role: String(role).toUpperCase() })
    .select("_id")
    .lean();
  if (!users.length) return;

  const subscriptions = await PushSubscription.find({
    userId: { $in: users.map((u) => u._id) },
  }).lean();

  await sendToSubscriptions(subscriptions, payload);
}

export async function sendPushToUser(userId, payload) {
  if (!vapidConfigured() || !userId) return;
  ensureConfigured();

  const subscriptions = await PushSubscription.find({ userId }).lean();
  await sendToSubscriptions(subscriptions, payload);
}
