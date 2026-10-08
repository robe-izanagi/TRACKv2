const { Op } = require('sequelize');
const { EmailQueue, User } = require('../models');
const { sendEmailNow } = require('./emailService');
const { createNotification } = require('./notificationService');

const POLL_INTERVAL_MS = 60 * 1000;
let intervalHandle = null;

async function processQueueOnce() {
  try {
    const now = new Date();
    const due = await EmailQueue.findAll({
      where: {
        status: 'pending',
        [Op.or]: [
          { scheduled_for: null },
          { scheduled_for: { [Op.lte]: now } }
        ]
      },
      limit: 20
    });

    for (const item of due) {
      try {
        // In-app reminders are independent from email delivery. An email provider
        // outage must not prevent the user from seeing their reminder in TRACK.
        if (item.email_type === 'reminder' && item.recipient_email && !item.in_app_notified_at) {
          const user = await User.findOne({ where: { email: item.recipient_email } });
          let notificationCreated = !user;
          if (user) {
            const notification = await createNotification({
              userId: user.id,
              type: item.entity_type === 'task' ? 'task_reminder' : 'event_reminder',
              title: item.subject,
              message: 'Check the details in TRACK.',
              entityType: item.entity_type || 'event',
              entityId: item.event_id || null,
            });
            notificationCreated = !!notification;
          }
          if (notificationCreated) {
            item.in_app_notified_at = new Date();
            await item.save();
          }
        }

        await sendEmailNow({
          to: item.recipient_email,
          subject: item.subject,
          html: item.body
        });
        item.status = 'sent';
        item.sent_at = new Date();
        item.error_message = null;
        await item.save();

      } catch (err) {
        console.error(`Failed to send queued email ${item.id}:`, err.message);
        item.status = 'failed';
        item.error_message = err.message;
        await item.save();
      }
    }
  } catch (err) {
    console.error('Email queue processing error:', err);
  }
}

exports.start = () => {
  if (intervalHandle) return;
  console.log('Email queue processor started.');
  processQueueOnce();
  intervalHandle = setInterval(processQueueOnce, POLL_INTERVAL_MS);
};

exports.stop = () => {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
};

exports.processQueueOnce = processQueueOnce;
