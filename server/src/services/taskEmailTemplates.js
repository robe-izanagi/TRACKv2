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
  scheduled_for = null, task_id = null, email_type = null
}) => {
  return EmailQueue.create({
    id: uuidv4(),
    recipient_email,
    subject,
    body,
    scheduled_for,
    event_id: task_id,
    entity_type: 'task',
    email_type,
    status: 'pending'
  });
};

exports.buildTaskAssignedEmail = (task, recipientName) => {
  const subject = `New task assigned: ${task.title}`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>You have been assigned a new task on TRACK:</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${task.title}</h3>
      <p style="margin:4px 0;"><strong>Deadline:</strong> ${formatDateTime(task.deadline_datetime)}</p>
      <p style="margin:4px 0;"><strong>Priority:</strong> ${task.priority}</p>
      ${task.description ? `<p style="margin:4px 0;">${task.description}</p>` : ''}
    </div>
    <p>Log in to TRACK to accept or decline this task.</p>
    <p><a href="${process.env.FRONTEND_URL}/tasks">View Task</a></p>
  `;
  return { subject, body };
};

exports.buildTaskCollaboratorEmail = (task, recipientName) => {
  const subject = `You've been added as a collaborator: ${task.title}`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>You have been added as a collaborator on the following task:</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${task.title}</h3>
      <p style="margin:4px 0;"><strong>Deadline:</strong> ${formatDateTime(task.deadline_datetime)}</p>
    </div>
    <p>You now have edit access to this task.</p>
    <p><a href="${process.env.FRONTEND_URL}/tasks">View Task</a></p>
  `;
  return { subject, body };
};

exports.buildTaskReminderEmail = (task, recipientName) => {
  const subject = `Reminder: ${task.title} is due soon`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>This is a reminder for an upcoming task deadline:</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${task.title}</h3>
      <p style="margin:4px 0;"><strong>Deadline:</strong> ${formatDateTime(task.deadline_datetime)}</p>
    </div>
    <p><a href="${process.env.FRONTEND_URL}/tasks">View Task</a></p>
  `;
  return { subject, body };
};

exports.buildTaskEditedEmail = (task, recipientName, status) => {
  const subject = `Task updated: ${task.title}`;
  const intro = status === 'pending'
    ? `The task you were assigned, "${task.title}", has been edited. Please review the updated details and respond.`
    : `A task you accepted, "${task.title}", has been updated. Please review the changes below.`;
  const body = `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>${intro}</p>
    <div style="background:#f4f4f4;padding:16px;border-radius:8px;">
      <h3 style="margin:0 0 8px 0;">${task.title}</h3>
      <p style="margin:4px 0;"><strong>Deadline:</strong> ${formatDateTime(task.deadline_datetime)}</p>
    </div>
    <p><a href="${process.env.FRONTEND_URL}/tasks">View Task</a></p>
  `;
  return { subject, body };
};

exports.buildTaskDeletedEmail = (task, recipientName) => ({
  subject: `Task canceled: ${task.title}`,
  body: `
    <h2>Hello ${recipientName || 'there'},</h2>
    <p>The task <strong>${task.title}</strong> has been deleted by its creator and is no longer available.</p>
    <p>You do not need to take any further action.</p>
  `
});
