const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const upload = require("../config/upload");
const { Attachment, Event, Task } = require("../models");
const { authenticate } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MiB per file

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

const getExtension = (fileName = "") =>
  path.extname(fileName).toLowerCase();

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

  if (file.size > MAX_FILE_SIZE) {
    return `"${file.originalname}" exceeds the 15 MB per-file limit.`;
  }

  if (
    !ALLOWED_EXTENSIONS.has(extension) ||
    !ALLOWED_MIME_TYPES.has(file.mimetype)
  ) {
    return `"${file.originalname}" is not allowed. Only PDF and DOCX files are accepted.`;
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
        message: "Invalid entity type",
      });
    }

    const Entity = entity_type === "event" ? Event : Task;

    Entity.findByPk(entity_id)
      .then((entity) => {
        if (!entity) {
          return res.status(404).json({
            ok: false,
            message: `${entity_type} not found`,
          });
        }

        // No total-size or file-count limit is applied here.
        // Each file is validated independently after multer parses the upload.
        upload.array("files")(req, res, (err) => {
          if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({
              ok: false,
              message: err.message,
            });
          }

          next();
        });
      })
      .catch((err) => {
        console.error("Entity lookup error:", err);
        res.status(500).json({
          ok: false,
          message: "Server error",
        });
      });
  },
  async (req, res) => {
    try {
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "No files uploaded",
        });
      }

      // Validate every file independently. There is intentionally NO
      // combined-size validation: 10 MB + 10 MB is still valid because
      // each file is under the 15 MB per-file limit.
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

      res.status(201).json({
        ok: true,
        attachments: records,
      });
    } catch (error) {
      console.error("Attachment save error:", error);
      res.status(500).json({
        ok: false,
        message: "Server error",
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
      message: "Server error.",
    });
  }
});

module.exports = router;
