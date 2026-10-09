const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const {
  sequelize,
  Task,
  TaskChecklistItem,
  TaskChecklistComment,
  TaskAssignee,
  TaskCollaborator,
  User,
  UserProfile,
  Department,
  Office,
  Position,
  PositionAssignment,
  Attachment,
  EmailQueue,
} = require("../models");
const {
  queueEmail, buildTaskAssignedEmail, buildTaskCollaboratorEmail,
  buildTaskReminderEmail, buildTaskEditedEmail, buildTaskDeletedEmail
} = require("../services/taskEmailTemplates");
const { createNotification } = require("../services/notificationService");
const {
  cancelPendingReminders,
  cancelUserReminder,
  getTaskParticipantIds,
  uniqueIds,
} = require("../services/notificationRecipients");

const getUserProfileSummary = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "username", "email"],
  });
  if (!user) return null;
  const profile = await UserProfile.findOne({ where: { user_id: user.id } });
  let department = null, office = null, position = null, fullName = null;
  if (profile) {
    fullName = profile.full_name;
    if (profile.department_id) {
      const d = await Department.findByPk(profile.department_id);
      if (d) department = d.name;
    }
    if (profile.office_id) {
      const o = await Office.findByPk(profile.office_id);
      if (o) office = o.name;
    }
    if (profile.position_id) {
      const p = await Position.findByPk(profile.position_id);
      if (p) position = p.name;
    }
  }
  return {
    id: user.id,
    full_name: fullName || user.username || user.email,
    email: user.email,
    username: user.username,
    department,
    office,
    position,
  };
};

const getUserContact = async (userId) => {
  const u = await User.findByPk(userId, { attributes: ['id', 'email'] });
  if (!u) return null;
  const profile = await UserProfile.findOne({ where: { user_id: userId } });
  return { email: u.email, full_name: profile?.full_name || u.email };
};

// ─── CREATE TASK ──────────────────────────────────────
exports.createTask = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      title, color, priority, visibility, deadline_datetime,
      department_id, office_id, description, remind_before_minutes,
      assignee_ids, collaborator_ids, checklist_items,
    } = req.body;

    const missingFields = [!title && 'title', !visibility && 'visibility', !deadline_datetime && 'deadline date and time'].filter(Boolean);
    if (missingFields.length > 0) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: `Please complete the following required fields: ${missingFields.join(', ')}.` });
    }

    let finalDepartmentId = null;
    if (visibility === "department") {
      if (!department_id) {
        await t.rollback();
        return res.status(400).json({ ok: false, message: "Select your department before creating a department task." });
      }
      const profile = await UserProfile.findOne({ where: { user_id: req.userId } });
      if (!profile || profile.department_id !== department_id) {
        await t.rollback();
        return res.status(403).json({ ok: false, message: "You can only create department tasks for your own department." });
      }
      finalDepartmentId = department_id;
    }

    const task = await Task.create(
      {
        id: uuidv4(),
        title,
        color: color || "#3B82F6",
        priority: priority || "medium",
        visibility,
        deadline_datetime,
        department_id: finalDepartmentId,
        office_id: office_id || null,
        creator_id: req.userId,
        description,
        remind_before_minutes: remind_before_minutes || null,
        is_email_reminder: true,
        is_completed: false,
        is_archived: false,
        is_deleted: false,
      },
      { transaction: t },
    );

    const assigneeIds = assignee_ids || [];
    const uniqueAssignees = [...new Set([req.userId, ...assigneeIds])];
    await TaskAssignee.bulkCreate(
      uniqueAssignees.map((userId) => ({
        task_id: task.id,
        user_id: userId,
        response: userId === req.userId ? "accepted" : "pending",
        is_original: userId === req.userId,
      })),
      { transaction: t },
    );

    const collaboratorIds = collaborator_ids || [];
    const uniqueCollaborators = [...new Set(collaboratorIds)];
    if (uniqueCollaborators.length > 0) {
      await TaskCollaborator.bulkCreate(
        uniqueCollaborators.map((userId) => ({ task_id: task.id, user_id: userId })),
        { transaction: t },
      );
    }

    if (checklist_items && Array.isArray(checklist_items) && checklist_items.length > 0) {
      const items = checklist_items.map((item, index) => ({
        id: uuidv4(),
        task_id: task.id,
        card_id: item.card_id ? String(item.card_id) : 'default',
        card_title: item.card_title || 'Checklist',
        text: item.text,
        sort_order: index,
        is_completed: false,
      }));
      await TaskChecklistItem.bulkCreate(items, { transaction: t });
    }

    await t.commit();

    try {
      const taskForEmail = {
        title: task.title, description: task.description,
        deadline_datetime: task.deadline_datetime, priority: task.priority,
      };
      const realAssigneeIds = assigneeIds.filter((id) => id !== req.userId);

      for (const userId of realAssigneeIds) {
        const contact = await getUserContact(userId);
        if (contact?.email) {
          const { subject, body } = buildTaskAssignedEmail(taskForEmail, contact.full_name);
          await queueEmail({ recipient_email: contact.email, subject, body, task_id: task.id, email_type: 'invitation' });
        }
        await createNotification({
          userId,
          type: 'task_invite',
          title: 'New Task Assigned',
          message: `You've been assigned to "${task.title}"`,
          entityType: 'task',
          entityId: task.id,
        });
      }

      for (const userId of uniqueCollaborators) {
        const contact = await getUserContact(userId);
        if (contact?.email) {
          const { subject, body } = buildTaskCollaboratorEmail(taskForEmail, contact.full_name);
          await queueEmail({ recipient_email: contact.email, subject, body, task_id: task.id, email_type: 'collaborator' });
        }
        await createNotification({
          userId,
          type: 'task_collaborator',
          title: 'Added as Collaborator',
          message: `You were added as a collaborator on task "${task.title}"`,
          entityType: 'task',
          entityId: task.id,
        });
      }

      if (remind_before_minutes) {
        const reminderTime = new Date(new Date(task.deadline_datetime).getTime() - Number(remind_before_minutes) * 60000);
        const recipientIds = [...new Set([req.userId, ...realAssigneeIds, ...uniqueCollaborators])];
        for (const userId of recipientIds) {
          const contact = await getUserContact(userId);
          if (!contact?.email) continue;
          const { subject, body } = buildTaskReminderEmail(taskForEmail, contact.full_name);
          await queueEmail({ recipient_email: contact.email, subject, body, scheduled_for: reminderTime, task_id: task.id, email_type: 'reminder' });
        }
      }
    } catch (emailErr) {
      console.error('Failed to queue task emails/notifications:', emailErr);
    }

    res.status(201).json({ ok: true, task: { id: task.id, title: task.title } });
  } catch (error) {
    await t.rollback();
    console.error("Create task error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── LIST TASKS ────────────────────────────────────────
exports.listTasks = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, visibility, priority, search } = req.query;

    const assigneeTasks = await TaskAssignee.findAll({ where: { user_id: userId }, attributes: ["task_id"] });
    const assigneeTaskIds = assigneeTasks.map((a) => a.task_id);

    const collaboratorTasks = await TaskCollaborator.findAll({ where: { user_id: userId }, attributes: ["task_id"] });
    const collaboratorTaskIds = collaboratorTasks.map((c) => c.task_id);

    const allTaskIds = [...new Set([...assigneeTaskIds, ...collaboratorTaskIds])];

    const where = {
      [Op.or]: [{ creator_id: userId }, { id: { [Op.in]: allTaskIds } }],
      is_archived: false,
      is_deleted: false,
    };

    if (status === "ongoing") {
      where.is_completed = false;
      where.deadline_datetime = { [Op.gte]: new Date() };
    } else if (status === "completed") {
      where.is_completed = true;
    } else if (status === "missed") {
      where.is_completed = false;
      where.deadline_datetime = { [Op.lt]: new Date() };
    }

    if (visibility && visibility !== "all") where.visibility = visibility;
    if (priority && priority !== "all") where.priority = priority;
    if (search) where.title = { [Op.like]: `%${search}%` };

    const tasks = await Task.findAll({ where, order: [["deadline_datetime", "ASC"]] });

    const result = [];
    for (const task of tasks) {
      const assigneeRecords = await TaskAssignee.findAll({ where: { task_id: task.id } });
      const assignees = [];
      for (const a of assigneeRecords) {
        const profile = await getUserProfileSummary(a.user_id);
        if (profile) assignees.push({ ...profile, response: a.response });
      }

      const userAssignee = assigneeRecords.find((a) => a.user_id === userId);
      const response = userAssignee ? userAssignee.response : null;
      const isCreator = task.creator_id === userId;
      const isCollaborator = collaboratorTaskIds.includes(task.id);
      const creatorProfile = await getUserProfileSummary(task.creator_id);

      const checklistItems = await TaskChecklistItem.findAll({ where: { task_id: task.id } });

      result.push({
        id: task.id,
        title: task.title,
        color: task.color,
        priority: task.priority,
        visibility: task.visibility,
        deadline_datetime: task.deadline_datetime,
        description: task.description,
        is_completed: task.is_completed,
        creator: creatorProfile,
        assignees,
        response,
        isCreator,
        isCollaborator,
        checklist_items: checklistItems.map((c) => ({ id: c.id, text: c.text, is_completed: c.is_completed })),
      });
    }

    res.json({ ok: true, tasks: result });
  } catch (error) {
    console.error("List tasks error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── GET TASK BY ID ────────────────────────────────────
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const task = await Task.findByPk(id);
    if (!task || task.is_archived || task.is_deleted) return res.status(404).json({ ok: false, message: "Task not found." });

    const assigneeRecords = await TaskAssignee.findAll({ where: { task_id: id } });
    const assignees = [];
    for (const a of assigneeRecords) {
      const profile = await getUserProfileSummary(a.user_id);
      if (profile) assignees.push({ ...profile, response: a.response });
    }

    const collaboratorRecords = await TaskCollaborator.findAll({ where: { task_id: id } });
    const collaborators = [];
    for (const c of collaboratorRecords) {
      const profile = await getUserProfileSummary(c.user_id);
      if (profile) collaborators.push(profile);
    }

    const checklist = await TaskChecklistItem.findAll({
      where: { task_id: id },
      order: [["sort_order", "ASC"]],
    });

    const checklistFormatted = [];
    for (const item of checklist) {
      let completedByProfile = null;
      if (item.completed_by_user_id) {
        completedByProfile = await getUserProfileSummary(item.completed_by_user_id);
      }
      const comments = await TaskChecklistComment.findAll({
        where: { checklist_item_id: item.id },
        order: [["created_at", "ASC"]],
      });
      const commentsFormatted = [];
      for (const c of comments) {
        const authorProfile = await getUserProfileSummary(c.user_id);
        commentsFormatted.push({
          id: c.id,
          text: c.comment_text,
          created_at: c.created_at,
          author: authorProfile,
        });
      }
      checklistFormatted.push({
        id: item.id,
        card_id: item.card_id || 'default',
        card_title: item.card_title || 'Checklist',
        text: item.text,
        is_completed: item.is_completed,
        completed_by: completedByProfile,
        completed_at: item.completed_at,
        comments: commentsFormatted,
      });
    }

    const creatorProfile = await getUserProfileSummary(task.creator_id);
    const userAssignee = assigneeRecords.find((a) => a.user_id === userId);
    const response = userAssignee ? userAssignee.response : null;

    const attachmentRecords = await Attachment.findAll({
      where: { entity_type: 'task', entity_id: task.id },
      attributes: ['id', 'file_name', 'file_url', 'file_size']
    });

    res.json({
      ok: true,
      task: {
        id: task.id,
        title: task.title,
        color: task.color,
        priority: task.priority,
        visibility: task.visibility,
        deadline_datetime: task.deadline_datetime,
        department_id: task.department_id,
        description: task.description,
        is_completed: task.is_completed,
        creator: creatorProfile,
        assignees,
        collaborators,
        checklist: checklistFormatted,
        attachments: attachmentRecords.map(a => ({ id: a.id, file_name: a.file_name, file_url: a.file_url, file_size: a.file_size })),
        response,
        isCreator: task.creator_id === userId,
        isCollaborator: collaboratorRecords.some((c) => c.user_id === userId),
      },
    });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── UPDATE TASK ───────────────────────────────────────
exports.updateTask = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      title, color, priority, visibility, deadline_datetime,
      department_id, office_id, description, remind_before_minutes,
      assignee_ids, collaborator_ids, checklist_items,
    } = req.body;

    const task = await Task.findByPk(id);
    if (!task || task.is_archived || task.is_deleted) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: "Task not found." });
    }

    const isCreator = task.creator_id === req.userId;
    const isCollaborator = await TaskCollaborator.findOne({ where: { task_id: id, user_id: req.userId } });
    if (!isCreator && !isCollaborator) {
      await t.rollback();
      return res.status(403).json({ ok: false, message: "You can edit this task only if you created it or were added as a collaborator." });
    }

    const isCollaboratorEdit = !isCreator;

    const missingFields = [!title && 'title', !visibility && 'visibility', !deadline_datetime && 'deadline date and time'].filter(Boolean);
    if (missingFields.length > 0) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: `Please complete the following required fields: ${missingFields.join(', ')}.` });
    }

    let finalVisibility = visibility;
    let finalDepartmentId = null;

    if (isCollaboratorEdit) {
      finalVisibility = task.visibility;
      finalDepartmentId = task.department_id;
    } else {
      if (visibility === "department") {
        if (!department_id) {
          await t.rollback();
          return res.status(400).json({ ok: false, message: "Select your department before saving a department task." });
        }
        const profile = await UserProfile.findOne({ where: { user_id: req.userId } });
        if (!profile || profile.department_id !== department_id) {
          await t.rollback();
          return res.status(403).json({ ok: false, message: "You can only set department tasks for your own department." });
        }
        finalDepartmentId = department_id;
      } else if (visibility === "campus") {
        const assignments = await PositionAssignment.findAll({ where: { user_id: req.userId, status: 'active' } });
        if (assignments.length === 0) {
          await t.rollback();
          return res.status(403).json({ ok: false, message: "Only users with the Heads role can set campus visibility." });
        }
      }
    }

    await task.update(
      {
        title, color: color || "#3B82F6", priority: priority || "medium",
        visibility: finalVisibility,
        deadline_datetime,
        department_id: finalDepartmentId,
        office_id: office_id || null,
        description,
        remind_before_minutes: remind_before_minutes || null,
        is_email_reminder: true,
        updated_at: new Date(),
      },
      { transaction: t },
    );

    const existingAssignees = await TaskAssignee.findAll({ where: { task_id: id }, attributes: ["user_id", "response"] });
    const existingMap = {};
    existingAssignees.forEach((a) => { existingMap[a.user_id] = a.response; });

    const submittedAssigneeIds = [...new Set((assignee_ids || []).filter(Boolean))];

    const toRemove = existingAssignees
      .filter((a) => a.user_id !== task.creator_id && !submittedAssigneeIds.includes(a.user_id))
      .map((a) => a.user_id);
    if (toRemove.length > 0) {
      await TaskAssignee.destroy({ where: { task_id: id, user_id: { [Op.in]: toRemove } }, transaction: t });
    }

    const toAdd = submittedAssigneeIds.filter((uid) => uid !== task.creator_id && !(uid in existingMap));
    if (toAdd.length > 0) {
      await TaskAssignee.bulkCreate(
        toAdd.map((userId) => ({ task_id: id, user_id: userId, response: "pending", is_original: false })),
        { transaction: t },
      );
    }

    const existingCollaborators = await TaskCollaborator.findAll({ where: { task_id: id }, attributes: ['user_id'] });
    const existingCollaboratorIds = existingCollaborators.map((collaborator) => collaborator.user_id);
    const submittedCollabIds = [...new Set((collaborator_ids || []).filter(Boolean))];
    const addedCollaboratorIds = submittedCollabIds.filter((userId) => !existingCollaboratorIds.includes(userId));
    const removedCollaboratorIds = existingCollaboratorIds.filter((userId) => !submittedCollabIds.includes(userId));
    await TaskCollaborator.destroy({ where: { task_id: id }, transaction: t });
    if (submittedCollabIds.length > 0) {
      await TaskCollaborator.bulkCreate(
        submittedCollabIds.map((userId) => ({ task_id: id, user_id: userId })),
        { transaction: t },
      );
    }

    if (checklist_items && Array.isArray(checklist_items)) {
      const existingItems = await TaskChecklistItem.findAll({ where: { task_id: id } });
      const keyOf = (cardId, text) => `${cardId}||${text}`;
      const existingByKey = {};
      existingItems.forEach((it) => { existingByKey[keyOf(it.card_id || 'default', it.text)] = it; });
      const keepIds = [];

      for (let index = 0; index < checklist_items.length; index++) {
        const incoming = checklist_items[index];
        const cardId = incoming.card_id ? String(incoming.card_id) : 'default';
        const cardTitle = incoming.card_title || 'Checklist';
        const key = keyOf(cardId, incoming.text);
        const match = existingByKey[key];
        if (match) {
          match.sort_order = index;
          match.card_title = cardTitle;
          if (incoming.is_completed !== undefined) match.is_completed = incoming.is_completed;
          await match.save({ transaction: t });
          keepIds.push(match.id);
        } else {
          const created = await TaskChecklistItem.create({
            id: uuidv4(), task_id: id, card_id: cardId, card_title: cardTitle,
            text: incoming.text, sort_order: index,
            is_completed: incoming.is_completed || false,
          }, { transaction: t });
          keepIds.push(created.id);
        }
      }
      const toDelete = existingItems.filter((it) => !keepIds.includes(it.id)).map((it) => it.id);
      if (toDelete.length > 0) {
        await TaskChecklistComment.destroy({ where: { checklist_item_id: { [Op.in]: toDelete } }, transaction: t });
        await TaskChecklistItem.destroy({ where: { id: { [Op.in]: toDelete } }, transaction: t });
      }
    }

    await t.commit();

    try {
      const taskForEmail = { title: task.title, description: task.description, deadline_datetime: task.deadline_datetime, priority: task.priority };
      const continuingIds = submittedAssigneeIds.filter((uid) => uid !== task.creator_id && uid in existingMap);

      for (const userId of continuingIds) {
        const priorResponse = existingMap[userId];
        if (priorResponse === 'pending' || priorResponse === 'accepted') {
          const contact = await getUserContact(userId);
          if (contact?.email) {
            const { subject, body } = buildTaskEditedEmail(taskForEmail, contact.full_name, priorResponse);
            await queueEmail({ recipient_email: contact.email, subject, body, task_id: id, email_type: 'edited' });
          }
        }
      }
      const updateRecipients = uniqueIds([
        ...continuingIds.filter((userId) => ['pending', 'accepted'].includes(existingMap[userId])),
        task.creator_id,
        ...submittedCollabIds.filter((userId) => existingCollaboratorIds.includes(userId)),
      ], [req.userId]);
      for (const userId of updateRecipients) {
        await createNotification({
          userId,
          type: 'task_update',
          title: 'Task Updated',
          message: `"${task.title}" has been updated. Review the latest details.`,
          entityType: 'task',
          entityId: id,
        });
      }
      for (const userId of toAdd) {
        const contact = await getUserContact(userId);
        if (contact?.email) {
          const { subject, body } = buildTaskAssignedEmail(taskForEmail, contact.full_name);
          await queueEmail({ recipient_email: contact.email, subject, body, task_id: id, email_type: 'invitation' });
        }
        await createNotification({
          userId,
          type: 'task_invite',
          title: 'New Task Assigned',
          message: `You've been assigned to "${task.title}"`,
          entityType: 'task',
          entityId: id,
        });
      }
      for (const userId of addedCollaboratorIds) {
        await createNotification({
          userId,
          type: 'task_collaborator',
          title: 'Added as Collaborator',
          message: `You can now edit the task "${task.title}".`,
          entityType: 'task',
          entityId: id,
        });
      }
      for (const userId of toRemove) {
        await createNotification({
          userId,
          type: 'task_assignee_removed',
          title: 'Removed from Task',
          message: `You are no longer assigned to "${task.title}".`,
        });
      }
      for (const userId of removedCollaboratorIds) {
        await createNotification({
          userId,
          type: 'task_collaborator_removed',
          title: 'Collaborator Access Removed',
          message: `You can no longer edit the task "${task.title}".`,
        });
      }
      await cancelPendingReminders({
        entityId: id,
        entityType: 'task',
        reason: 'Task details changed; a new reminder schedule was created.',
      });
      if (remind_before_minutes) {
        const reminderTime = new Date(new Date(task.deadline_datetime).getTime() - Number(remind_before_minutes) * 60000);
        const recipientIds = uniqueIds([
          task.creator_id,
          ...submittedAssigneeIds.filter((userId) => existingMap[userId] !== 'declined'),
          ...submittedCollabIds,
        ]);
        for (const userId of recipientIds) {
          const contact = await getUserContact(userId);
          if (!contact?.email) continue;
          const { subject, body } = buildTaskReminderEmail(taskForEmail, contact.full_name);
          await queueEmail({ recipient_email: contact.email, subject, body, scheduled_for: reminderTime, task_id: id, email_type: 'reminder' });
        }
      }
    } catch (emailErr) {
      console.error('Failed to queue task update emails/notifications:', emailErr);
    }

    res.json({ ok: true, message: "Task updated successfully." });
  } catch (error) {
    await t.rollback();
    console.error("Update task error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── TOGGLE CHECKLIST ITEM ─────────────
exports.toggleChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { is_completed } = req.body;

    const item = await TaskChecklistItem.findByPk(itemId);
    if (!item) return res.status(404).json({ ok: false, message: "Item not found." });

    const task = await Task.findByPk(item.task_id);
    if (!task || task.is_archived || task.is_deleted) return res.status(404).json({ ok: false, message: "Task not found." });

    const isAssignee = await TaskAssignee.findOne({ where: { task_id: task.id, user_id: req.userId } });
    const isCollaborator = await TaskCollaborator.findOne({ where: { task_id: task.id, user_id: req.userId } });
    if (!isAssignee && !isCollaborator && task.creator_id !== req.userId) {
      return res.status(403).json({ ok: false, message: "You can update this checklist item only if you are the task creator, an assignee, or a collaborator." });
    }

    if (is_completed === undefined) {
      return res.status(400).json({ ok: false, message: "Choose whether this checklist item is complete before saving." });
    }

    item.is_completed = !!is_completed;
    if (item.is_completed) {
      item.completed_by_user_id = req.userId;
      item.completed_at = new Date();
    } else {
      item.completed_by_user_id = null;
      item.completed_at = null;
    }
    await item.save();

    try {
      const actor = await getUserProfileSummary(req.userId);
      const collaborators = await TaskCollaborator.findAll({ where: { task_id: task.id }, attributes: ['user_id'] });
      const recipients = uniqueIds([task.creator_id, ...collaborators.map((collaborator) => collaborator.user_id)], [req.userId]);
      for (const userId of recipients) {
        await createNotification({
          userId,
          type: item.is_completed ? 'task_checklist_completed' : 'task_checklist_reopened',
          title: item.is_completed ? 'Checklist Item Completed' : 'Checklist Item Reopened',
          message: `${actor?.full_name || 'Someone'} ${item.is_completed ? 'completed' : 'reopened'} “${item.text}” in "${task.title}".`,
          entityType: 'task',
          entityId: task.id,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create checklist notification:', notificationError);
    }

    res.json({ ok: true, item });
  } catch (error) {
    console.error("Toggle checklist error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── ADD CHECKLIST COMMENT ──────────────────
exports.addChecklistComment = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { comment_text } = req.body;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ ok: false, message: "Enter a comment before submitting it." });
    }

    const item = await TaskChecklistItem.findByPk(itemId);
    if (!item) return res.status(404).json({ ok: false, message: "Item not found." });

    const task = await Task.findByPk(item.task_id);
    if (!task || task.is_archived || task.is_deleted) return res.status(404).json({ ok: false, message: "Task not found." });

    const isAssignee = await TaskAssignee.findOne({ where: { task_id: task.id, user_id: req.userId } });
    const isCollaborator = await TaskCollaborator.findOne({ where: { task_id: task.id, user_id: req.userId } });
    if (!isAssignee && !isCollaborator && task.creator_id !== req.userId) {
      return res.status(403).json({ ok: false, message: "You can comment only if you are the task creator, an assignee, or a collaborator." });
    }

    const comment = await TaskChecklistComment.create({
      id: uuidv4(),
      checklist_item_id: itemId,
      user_id: req.userId,
      comment_text: comment_text.trim(),
    });

    const authorProfile = await getUserProfileSummary(req.userId);

    try {
      const participants = await getTaskParticipantIds(task.id);
      const recipients = uniqueIds([task.creator_id, ...participants], [req.userId]);
      for (const userId of recipients) {
        await createNotification({
          userId,
          type: 'task_checklist_comment',
          title: 'New Checklist Comment',
          message: `${authorProfile?.full_name || 'Someone'} commented on “${item.text}” in "${task.title}".`,
          entityType: 'task',
          entityId: task.id,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create checklist comment notification:', notificationError);
    }

    res.status(201).json({
      ok: true,
      comment: { id: comment.id, text: comment.comment_text, created_at: comment.created_at, author: authorProfile },
    });
  } catch (error) {
    console.error("Add checklist comment error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── RESPOND TO TASK INVITATION (notifies creator) ──────
exports.respondToTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { response } = req.body;

    if (!["accepted", "declined"].includes(response)) {
      return res.status(400).json({ ok: false, message: "Choose either accept or decline to respond to this task assignment." });
    }

    const task = await Task.findByPk(taskId);
    if (!task || task.is_archived || task.is_deleted) {
      return res.status(404).json({ ok: false, message: "Task not found." });
    }
    const assignee = await TaskAssignee.findOne({ where: { task_id: taskId, user_id: req.userId } });
    if (!assignee) {
      return res.status(404).json({ ok: false, message: "You are not assigned to this task." });
    }

    assignee.response = response;
    await assignee.save();

    try {
      if (task) {
        const responderProfile = await getUserProfileSummary(req.userId);
        const collaborators = await TaskCollaborator.findAll({ where: { task_id: task.id }, attributes: ['user_id'] });
        const recipients = uniqueIds([task.creator_id, ...collaborators.map((collaborator) => collaborator.user_id)], [req.userId]);
        for (const userId of recipients) {
          await createNotification({
            userId,
            type: 'task_response',
            title: 'Task Response',
            message: `${responderProfile?.full_name || 'Someone'} ${response} the task "${task.title}".`,
            entityType: 'task',
            entityId: task.id,
          });
        }
        const contact = await getUserContact(req.userId);
        if (contact?.email) {
          await cancelUserReminder({
            entityId: task.id,
            entityType: 'task',
            email: contact.email,
            reason: `Task response changed to ${response}.`,
          });
          if (response === 'accepted' && task.remind_before_minutes) {
            const reminderTime = new Date(
              new Date(task.deadline_datetime).getTime() - Number(task.remind_before_minutes) * 60000,
            );
            const { subject, body } = buildTaskReminderEmail(task, contact.full_name);
            await queueEmail({
              recipient_email: contact.email,
              subject,
              body,
              scheduled_for: reminderTime,
              task_id: task.id,
              email_type: 'reminder',
            });
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to create response notification:', notifErr);
    }

    res.json({ ok: true, message: `Task ${response}.` });
  } catch (error) {
    console.error("Respond to task error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── GET INVITED TASKS ──────────────────────────────────
exports.getInvitedTasks = async (req, res) => {
  try {
    const userId = req.userId;
    const { response } = req.query;

    const where = { user_id: userId };
    if (response === "all") {
      // no filter
    } else if (response && ["pending", "accepted", "declined"].includes(response)) {
      where.response = response;
    } else {
      where.response = "pending";
    }

    const assignees = await TaskAssignee.findAll({ where });

    const tasks = [];
    for (const a of assignees) {
      const task = await Task.findByPk(a.task_id);
      if (!task || task.is_archived || task.is_deleted) continue;
      const creatorProfile = await getUserProfileSummary(task.creator_id);
      tasks.push({
        id: task.id,
        title: task.title,
        color: task.color,
        priority: task.priority,
        deadline_datetime: task.deadline_datetime,
        visibility: task.visibility,
        description: task.description,
        creator: creatorProfile,
        response: a.response,
      });
    }

    res.json({ ok: true, tasks });
  } catch (error) {
    console.error("Get invited tasks error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

// ─── DELETE TASK (Archive) ────────────────────────────
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task || task.is_deleted) return res.status(404).json({ ok: false, message: "Task not found." });
    if (task.creator_id !== req.userId) {
      return res.status(403).json({ ok: false, message: "Only the task creator can delete this task. Collaborators can edit it but cannot delete it." });
    }
    const assigneeRows = await TaskAssignee.findAll({ where: { task_id: task.id }, attributes: ["user_id"] });
    const collaboratorRows = await TaskCollaborator.findAll({ where: { task_id: task.id }, attributes: ["user_id"] });
    const recipientIds = [...new Set([...assigneeRows, ...collaboratorRows].map((row) => row.user_id).filter((id) => id !== req.userId))];
    task.is_deleted = true;
    task.updated_at = new Date();
    await task.save();
    await EmailQueue.update({ status: 'failed', error_message: 'Task deleted.' }, { where: { event_id: task.id, entity_type: 'task', status: 'pending' } });
    try {
      for (const userId of recipientIds) {
        const contact = await getUserContact(userId);
        if (contact?.email) {
          const { subject, body } = buildTaskDeletedEmail(task, contact.full_name);
          await queueEmail({ recipient_email: contact.email, subject, body, task_id: task.id, email_type: 'deleted' });
        }
        await createNotification({ userId, type: 'task_deleted', title: 'Task Deleted', message: `The task \"${task.title}\" has been deleted by its creator.`, entityType: 'task', entityId: task.id });
      }
    } catch (notificationError) {
      console.error("Failed to notify task participants about deletion:", notificationError);
    }
    res.json({ ok: true, message: "Task deleted." });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
};

exports.listArchivedTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({ where: { creator_id: req.userId, is_archived: true, is_deleted: false }, order: [['updated_at', 'DESC']] });
    const result = [];
    for (const task of tasks) {
      const assignees = await TaskAssignee.findAll({
        where: { task_id: task.id, user_id: { [Op.ne]: task.creator_id } },
        attributes: ['user_id', 'response'],
      });
      const assigneeIds = assignees.map((assignee) => assignee.user_id);
      const [users, profiles] = assigneeIds.length > 0
        ? await Promise.all([
          User.findAll({ where: { id: { [Op.in]: assigneeIds } }, attributes: ['id', 'username', 'email'] }),
          UserProfile.findAll({ where: { user_id: { [Op.in]: assigneeIds } }, attributes: ['user_id', 'full_name'] }),
        ])
        : [[], []];
      const userById = new Map(users.map((user) => [user.id, user]));
      const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
      const deadlineTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(task.deadline_datetime);
      const checklist = await TaskChecklistItem.findAll({ where: { task_id: task.id }, order: [['sort_order', 'ASC']] });
      result.push({
        id: task.id, title: task.title, color: task.color, priority: task.priority,
        visibility: task.visibility, department_id: task.department_id, office_id: task.office_id,
        description: task.description, remind_before_minutes: task.remind_before_minutes,
        deadline_time: deadlineTime,
        assignee_ids: assigneeIds,
        assignees: assignees.map((assignee) => {
          const user = userById.get(assignee.user_id);
          const profile = profileByUserId.get(assignee.user_id);
          return {
            id: assignee.user_id,
            full_name: profile?.full_name || user?.username || user?.email || 'Unknown assignee',
            email: user?.email || null,
            response: assignee.response,
          };
        }),
        checklist_items: checklist.map(item => ({ card_id: item.card_id || 'default', card_title: item.card_title || 'Checklist', text: item.text }))
      });
    }
    res.json({ ok: true, tasks: result });
  } catch (error) {
    console.error('List archived tasks error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

exports.archiveTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task || task.is_deleted) return res.status(404).json({ ok: false, message: 'Task not found.' });
    if (task.creator_id !== req.userId) return res.status(403).json({ ok: false, message: 'Only the task creator can archive this task.' });
    task.is_archived = true;
    task.updated_at = new Date();
    await task.save();
    await cancelPendingReminders({ entityId: task.id, entityType: 'task', reason: 'Task archived.' });
    const assignees = await TaskAssignee.findAll({ where: { task_id: task.id }, attributes: ['user_id'] });
    const collaborators = await TaskCollaborator.findAll({ where: { task_id: task.id }, attributes: ['user_id'] });
    for (const userId of uniqueIds([...assignees, ...collaborators].map((row) => row.user_id), [req.userId])) {
      await createNotification({
        userId,
        type: 'task_archived',
        title: 'Task Archived',
        message: `The task "${task.title}" was archived by its creator and is no longer active.`,
      });
    }
    res.json({ ok: true, message: 'Task archived.' });
  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};
