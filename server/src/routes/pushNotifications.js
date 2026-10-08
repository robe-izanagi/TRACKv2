const crypto = require('crypto');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PushSubscription } = require('../models');
const { authenticate } = require('../middleware/auth');
const { isConfigured, getPublicKey } = require('../services/pushNotificationService');

const router = express.Router();
const endpointHash = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');
const isValidEndpoint = (endpoint) => {
  if (typeof endpoint !== 'string') return false;
  try {
    return new URL(endpoint).protocol === 'https:';
  } catch {
    return false;
  }
};

router.get('/public-key', authenticate, (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      ok: false,
      message: 'Browser push notifications are not configured on this server yet.',
    });
  }
  return res.json({ ok: true, publicKey: getPublicKey() });
});

router.post('/subscriptions', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!isConfigured()) {
      return res.status(503).json({ ok: false, message: 'Browser push notifications are not configured on this server yet.' });
    }
    if (
      !isValidEndpoint(endpoint)
      || typeof keys?.p256dh !== 'string'
      || !keys.p256dh
      || typeof keys?.auth !== 'string'
      || !keys.auth
    ) {
      return res.status(400).json({
        ok: false,
        message: 'The browser returned an incomplete push subscription. Check browser notification settings, then enable push again.',
      });
    }

    const hash = endpointHash(endpoint);
    const existing = await PushSubscription.findOne({ where: { endpoint_hash: hash } });
    if (existing) {
      await existing.update({
        user_id: req.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date(),
      });
    } else {
      await PushSubscription.create({
        id: uuidv4(), user_id: req.userId, endpoint_hash: hash, endpoint,
        p256dh: keys.p256dh, auth: keys.auth,
      });
    }
    return res.status(201).json({ ok: true, message: 'Browser push notifications are enabled for this device.' });
  } catch (error) {
    console.error('Save push subscription error:', error);
    return res.status(500).json({ ok: false, message: 'We could not save your browser notification setting. Please try again.' });
  }
});

router.delete('/subscriptions', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!isValidEndpoint(endpoint)) {
      return res.status(400).json({ ok: false, message: 'A valid browser subscription is required to disable push notifications. Refresh the page and try again.' });
    }
    await PushSubscription.destroy({ where: { user_id: req.userId, endpoint_hash: endpointHash(endpoint) } });
    return res.json({ ok: true, message: 'Browser push notifications are disabled for this device.' });
  } catch (error) {
    console.error('Remove push subscription error:', error);
    return res.status(500).json({ ok: false, message: 'We could not remove your browser notification setting. Please try again.' });
  }
});

module.exports = router;
