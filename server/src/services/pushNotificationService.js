const webpush = require('web-push');
const { PushSubscription } = require('../models');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;
const isConfigured = Boolean(publicKey && privateKey && subject);

if (isConfigured) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} else {
  console.warn('Browser push notifications are disabled until VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are configured.');
}

exports.isConfigured = () => isConfigured;
exports.getPublicKey = () => (isConfigured ? publicKey : null);

exports.sendPushNotification = async (userId, payload) => {
  if (!isConfigured || !userId) return;

  try {
    const subscriptions = await PushSubscription.findAll({ where: { user_id: userId } });
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify(payload));
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await subscription.destroy();
          return;
        }
        console.error(`Unable to send browser push notification to ${userId}:`, error.message);
      }
    }));
  } catch (error) {
    console.error('Unable to look up browser push subscriptions:', error.message);
  }
};
