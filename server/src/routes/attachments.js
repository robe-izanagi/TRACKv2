const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { Attachment, Event, Task } = require('../models');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.post('/:entity_type/:entity_id', authenticate, (req, res, next) => {
  const { entity_type, entity_id } = req.params;

  if (!['event', 'task'].includes(entity_type)) {
    return res.status(400).json({ ok: false, message: 'Invalid entity type' });
  }

  const Entity = entity_type === 'event' ? Event : Task;
  Entity.findByPk(entity_id)
    .then(entity => {
      if (!entity) {
        return res.status(404).json({ ok: false, message: `${entity_type} not found` });
      }
      // Proceed with multer upload
      upload.array('files', 10)(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({ ok: false, message: err.message });
        }
        next();
      });
    })
    .catch(err => {
      console.error('Entity lookup error:', err);
      res.status(500).json({ ok: false, message: 'Server error' });
    });
}, async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ ok: false, message: 'No files uploaded' });
    }

    const records = [];
    for (const file of files) {
      const record = await Attachment.create({
        id: uuidv4(),
        entity_type: req.params.entity_type,
        entity_id: req.params.entity_id,
        file_url: `/uploads/${file.filename}`,
        file_name: file.originalname,
        file_size: file.size,
      });
      records.push(record);
    }

    res.status(201).json({ ok: true, attachments: records });
  } catch (error) {
    console.error('Attachment save error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;