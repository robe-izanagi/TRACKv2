const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const upload = require("../config/upload");
const { Attachment, Event, Task } = require("../models");
const { authenticate } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const { createNotification } = require('../services/notificationService');
const { getEventParticipantIds, getTaskParticipantIds, uniqueIds } = require('../services/notificationRecipients');

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MiB per file
const MAX_ATTACHMENT_COUNT = 5;

const ALLOWED_MIME_TYPES_BY_EXTENSION = {
  ".doc": new Set(["application/msword"]),
  ".docx": new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  ".txt": new Set(["text/plain"]),
  ".pdf": new Set(["application/pdf"]),
  ".png": new Set(["image/png"]),
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".mp4": new Set(["video/mp4", "application/mp4"]),
  ".mp3": new Set(["audio/mpeg", "audio/mp3"]),
};

const getExtension = (fileName = "") =>
  path.extname(fileName).toLowerCase();
const getAllowedTypesMessage = () =>
  "Only DOC, DOCX, TXT, PDF, PNG, JPG, MP4, and MP3 files are accepted.";

const getStoredFilePath = (file) => {
  if (file?.path) return file.path;
  if (file?.filename) return path.join(__dirname, "../uploads", file.filename);
  return null;
};

const removeUploadedFiles = async (files = []) => {
  await Promise.all(
    files.map(async (file) => {
      const filePath = getStoredFilePath(file);
      if (!filePath) return;

      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Failed to remove rejected upload:", err);
        }
      }
    }),
  );
};

const validateUploadedFile = (file) => {
  const extension = getExtension(file.originalname);
  const allowedMimeTypes = ALLOWED_MIME_TYPES_BY_EXTENSION[extension];

  if (file.size > MAX_FILE_SIZE) {
    return `"${file.originalname}" exceeds the 15 MB per-file limit.`;
  }

  if (
    !allowedMimeTypes ||
    (file.mimetype &&
      file.mimetype !== "application/octet-stream" &&
      !allowedMimeTypes.has(file.mimetype.toLowerCase()))
  ) {
    return `"${file.originalname}" is not an allowed type. ${getAllowedTypesMessage()}`;
  }

  return null;
};

router.post(
  "/:entity_type/:entity_id",
  authenticate,
  (req, res, next) => {
    const { entity_type, entity_id } = req.params;

    if (!["event", "task"].includes(entity_type)) {
      return res.status(400).json({
        ok: false,
        message: "Attachments can only be added to an event or task.",
      });
    }

    const Entity = entity_type === "event" ? Event : Task;

    Entity.findByPk(entity_id)
      .then(async (entity) => {
        if (!entity || entity.is_archived || entity.is_deleted) {
          return res.status(404).json({
            ok: false,
            message: `This ${entity_type} is no longer available. It may have been archived or deleted.`,
          });
        }

        const existingAttachmentCount = await Attachment.count({
          where: { entity_type, entity_id },
        });
        if (existingAttachmentCount >= MAX_ATTACHMENT_COUNT) {
          return res.status(400).json({
            ok: false,
            message: `This ${entity_type} already has the maximum of 5 attachments. Remove an attachment before adding another.`,
          });
        }

        upload.array("files", MAX_ATTACHMENT_COUNT)(req, res, async (err) => {
          if (err) {
            await removeUploadedFiles(req.files || []);
            console.error("Multer error:", err);
            return res.status(400).json({
              ok: false,
              message: err.code === "LIMIT_FILE_SIZE"
                ? "Each attachment must be 15 MB or smaller."
                : err.code === "LIMIT_UNEXPECTED_FILE"
                  ? "You can upload no more than 5 files in one request."
                  : err.message,
            });
          }

          next();
        });
      })
      .catch((err) => {
        console.error("Entity lookup error:", err);
        res.status(500).json({
          ok: false,
          message: "We could not verify the item for this upload. Please try again.",
        });
      });
  },
  async (req, res) => {
    try {
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({
          ok: false,
          message: `Choose at least one file. ${getAllowedTypesMessage()}`,
        });
      }

      const currentAttachmentCount = await Attachment.count({
        where: {
          entity_type: req.params.entity_type,
          entity_id: req.params.entity_id,
        },
      });
      if (currentAttachmentCount + files.length > MAX_ATTACHMENT_COUNT) {
        await removeUploadedFiles(files);
        return res.status(400).json({
          ok: false,
          message: `An event or task can have no more than 5 attachments. It currently has ${currentAttachmentCount}; remove an attachment before adding more.`,
        });
      }

      const invalidFiles = files
        .map((file) => ({ file, error: validateUploadedFile(file) }))
        .filter(({ error }) => error);

      if (invalidFiles.length > 0) {
        // Remove all files from this batch so a partially accepted upload
        // cannot leave orphan files on disk.
        await removeUploadedFiles(files);

        return res.status(400).json({
          ok: false,
          message: invalidFiles.map(({ error }) => error).join(" "),
          invalid_files: invalidFiles.map(({ file, error }) => ({
            name: file.originalname,
            reason: error,
          })),
        });
      }

      const records = [];

      for (const file of files) {
        const record = await Attachment.create({
          id: uuidv4(),
          entity_type: req.params.entity_type,
          entity_id: req.params.entity_id,
          // Keep the stored file path in the database. The actual browser
          // download uses /attachments/download/:id below, not this path.
          file_url: `/uploads/${file.filename}`,
          file_name: file.originalname,
          file_size: file.size,
        });

        records.push(record);
      }

      try {
        const isEvent = req.params.entity_type === 'event';
        const Entity = isEvent ? Event : Task;
        const entity = await Entity.findByPk(req.params.entity_id);
        if (entity) {
          const participantIds = isEvent
            ? await getEventParticipantIds(entity.id)
            : await getTaskParticipantIds(entity.id);
          const recipients = uniqueIds([entity.creator_id, ...participantIds], [req.userId]);
          const fileLabel = records.length === 1 ? `the attachment “${records[0].file_name}”` : `${records.length} attachments`;
          for (const userId of recipients) {
            await createNotification({
              userId,
              type: isEvent ? 'event_attachment_added' : 'task_attachment_added',
              title: records.length === 1 ? 'Attachment Added' : 'Attachments Added',
              message: `${fileLabel} ${records.length === 1 ? 'was' : 'were'} added to "${entity.title}".`,
              entityType: isEvent ? 'event' : 'task',
              entityId: entity.id,
            });
          }
        }
      } catch (notificationError) {
        console.error('Failed to create attachment notifications:', notificationError);
      }

      res.status(201).json({
        ok: true,
        attachments: records,
      });
    } catch (error) {
      console.error("Attachment save error:", error);
      res.status(500).json({
        ok: false,
        message: "Your files could not be saved. Please try uploading them again.",
      });
    }
  },
);

// Always download through the authenticated backend instead of exposing
// /uploads directly. This also fixes broken relative /uploads links when the
// frontend and backend are served from different origins or when /uploads is
// not registered as a static Express path.
router.get("/download/:id", authenticate, async (req, res) => {
  try {
    const attachment = await Attachment.findByPk(req.params.id);

    if (!attachment) {
      return res.status(404).json({
        ok: false,
        message: "Attachment not found.",
      });
    }

    const Entity = attachment.entity_type === "event" ? Event : Task;
    const entity = await Entity.findByPk(attachment.entity_id);
    if (!entity || entity.is_archived || entity.is_deleted) {
      return res.status(404).json({ ok: false, message: "Attachment not found." });
    }

    let storedFilename = "";
    try {
      const parsedUrl = new URL(
        attachment.file_url,
        "http://attachment.local",
      );
      storedFilename = path.basename(parsedUrl.pathname);
    } catch {
      storedFilename = path.basename(attachment.file_url || "");
    }

    if (!storedFilename) {
      return res.status(404).json({
        ok: false,
        message: "Attachment file path is invalid.",
      });
    }

    const filePath = path.join(__dirname, "../uploads", storedFilename);

    fs.access(filePath, fs.constants.R_OK, (accessErr) => {
      if (accessErr) {
        console.error("Attachment file missing:", accessErr);
        return res.status(404).json({
          ok: false,
          message: "Attachment file is no longer available on the server.",
        });
      }

      return res.download(
        filePath,
        attachment.file_name || storedFilename,
        (downloadErr) => {
          if (downloadErr && !res.headersSent) {
            console.error("Attachment download error:", downloadErr);
            res.status(500).json({
              ok: false,
              message: "Failed to download attachment.",
            });
          }
        },
      );
    });
  } catch (error) {
    console.error("Attachment download lookup error:", error);
    res.status(500).json({
      ok: false,
      message: "We could not find this attachment. Please refresh and try again.",
    });
  }
});

module.exports = router;
