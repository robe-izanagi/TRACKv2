const { v4: uuidv4 } = require('uuid');
const { Attachment, Event, Task } = require('../models');
const path = require('path');

exports.uploadAttachments = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;   // e.g. /attachments/event/:id
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ ok: false, message: 'No files uploaded.' });
    }

    if (!['event', 'task'].includes(entity_type)) {
      return res.status(400).json({ ok: false, message: 'Invalid entity type.' });
    }

    // Check if the event/task exists
    const Entity = entity_type === 'event' ? Event : Task;
    const entity = await Entity.findByPk(entity_id);
    if (!entity) {
      return res.status(404).json({ ok: false, message: `${entity_type} not found.` });
    }

    // Create attachment records
    const records = [];
    for (const file of files) {
      const record = await Attachment.create({
        id: uuidv4(),
        entity_type,
        entity_id,
        file_url: `/uploads/${file.filename}`,       // relative URL for downloading
        file_name: file.originalname,
        file_size: file.size
      });
      records.push(record);
    }

    res.status(201).json({ ok: true, attachments: records });
  } catch (error) {
    console.error('Upload attachments error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};