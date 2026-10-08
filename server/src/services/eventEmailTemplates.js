const { v4: uuidv4 } = require('uuid');
const { EmailQueue } = require('../models');

const formatDateTime = (date) => {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

exports.queueEmail = async ({
  recipient_email, subject, body,
  scheduled_for = null, event_id = null, entity_type = 'event', email_type = null
}) => {
  return EmailQueue.create({
    id: uuidv4(),
    recipient_email,
    subject,
    body,
    scheduled_for,
    event_id,
    entity_type,
    email_type,
    status: 'pending'
  });
};

exports.buildInvitationEmail = (event, recipientName) => {
  const subject = `You're invited: ${event.title}`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>You have been invited to an event on TRACK:</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${event.title}</h3>
      <p style="margin:4px 0;"><strong>When:</strong> ${formatDateTime(event.start_datetime)} — ${formatDateTime(event.end_datetime)}</p>
      <p style="margin:4px 0;"><strong>Method:</strong> ${event.method}</p>
      ${event.description ? `<p style="margin:4px 0;">${event.description}</p>` : ''}
    </div>
    <p>Log in to TRACK to accept or decline this invitation.</p>
    <p><a href="${process.env.FRONTEND_URL}/events">View Invitation</a></p>
  `;
  return { subject, body };
};

exports.buildCollaboratorEmail = (event, recipientName) => {
  const subject = `You've been added as a collaborator: ${event.title}`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>You have been added as a collaborator on the following event:</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${event.title}</h3>
      <p style="margin:4px 0;"><strong>When:</strong> ${formatDateTime(event.start_datetime)} — ${formatDateTime(event.end_datetime)}</p>
    </div>
    <p>You now have edit access to this event.</p>
    <p><a href="${process.env.FRONTEND_URL}/events">View Event</a></p>
  `;
  return { subject, body };
};

exports.buildReminderEmail = (event, recipientName) => {
  const subject = `Reminder: ${event.title} is coming up`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>This is a reminder for an upcoming event:</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${event.title}</h3>
      <p style="margin:4px 0;"><strong>When:</strong> ${formatDateTime(event.start_datetime)} — ${formatDateTime(event.end_datetime)}</p>
      <p style="margin:4px 0;"><strong>Method:</strong> ${event.method === 'online' ? (event.link || 'Online') : 'Face-to-face'}</p>
    </div>
    <p><a href="${process.env.FRONTEND_URL}/events">View Event</a></p>
  `;
  return { subject, body };
};

exports.buildEventEditedEmail = (event, recipientName, status) => {
  const subject = `Event updated: ${event.title}`;
  const intro = status === 'pending'
    ? `The event you were invited to, "${event.title}", has been edited by the organizer. Please review the updated details and respond.`
    : `An event you accepted, "${event.title}", has been updated by the organizer. Please review the changes below.`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>${intro}</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${event.title}</h3>
      <p style="margin:4px 0;"><strong>When:</strong> ${formatDateTime(event.start_datetime)} — ${formatDateTime(event.end_datetime)}</p>
      <p style="margin:4px 0;"><strong>Method:</strong> ${event.method}</p>
    </div>
    <p><a href="${process.env.FRONTEND_URL}/events">View Event</a></p>
  `;
  return { subject, body };
};

exports.buildEventDeletedEmail = (event, recipientName) => ({
  subject: `Event canceled: ${event.title}`,
  body: `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>The event <strong>${event.title}</strong> has been deleted by its creator and is no longer available.</p>
    <p>You do not need to take any further action.</p>
  `
});
