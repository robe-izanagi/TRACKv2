const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024; // 15 MiB per file

const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_ATTACHMENT_EXTENSIONS = [".pdf", ".docx"];

const getExtension = (fileName = "") => {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
};

const validateAttachment = (file) => {
  const extension = getExtension(file.name);

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return {
      ok: false,
      message: `${file.name} exceeds the 15 MB per-file limit.`,
    };
  }

  const validExtension = ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extension);
  const validMime =
    !file.type || ACCEPTED_ATTACHMENT_MIME_TYPES.includes(file.type);

  if (!validExtension || !validMime) {
    return {
      ok: false,
      message: `${file.name} is not allowed. Only PDF and DOCX files are accepted.`,
    };
  }

  return { ok: true };
};

export const validateAttachmentFiles = (files = []) => {
  const errors = files
    .map((file) => validateAttachment(file))
    .filter((result) => !result.ok)
    .map((result) => result.message);

  if (errors.length > 0) {
    return {
      ok: false,
      message: errors.length === 1
        ? errors[0]
        : `${errors.length} files were rejected. Each file must be a PDF or DOCX and must not exceed 15 MB.`,
      errors,
    };
  }

  return { ok: true, errors: [] };
};

export {
  MAX_ATTACHMENT_SIZE,
  ACCEPTED_ATTACHMENT_MIME_TYPES,
  ACCEPTED_ATTACHMENT_EXTENSIONS,
};
