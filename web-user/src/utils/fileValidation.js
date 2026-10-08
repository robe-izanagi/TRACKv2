const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;

const ACCEPTED_ATTACHMENT_TYPES = {
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".txt": ["text/plain"],
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".mp4": ["video/mp4", "application/mp4"],
  ".mp3": ["audio/mpeg", "audio/mp3"],
};

const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  ...new Set(Object.values(ACCEPTED_ATTACHMENT_TYPES).flat()),
];
const ACCEPTED_ATTACHMENT_EXTENSIONS = Object.keys(ACCEPTED_ATTACHMENT_TYPES);
const ACCEPTED_ATTACHMENT_INPUT_TYPES = [
  ...ACCEPTED_ATTACHMENT_EXTENSIONS,
  ...ACCEPTED_ATTACHMENT_MIME_TYPES,
].join(",");

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

  const acceptedMimeTypes = ACCEPTED_ATTACHMENT_TYPES[extension];
  if (
    !acceptedMimeTypes ||
    (file.type &&
      file.type.toLowerCase() !== "application/octet-stream" &&
      !acceptedMimeTypes.includes(file.type.toLowerCase()))
  ) {
    return {
      ok: false,
      message: `${file.name} is not an allowed type. Choose DOC, DOCX, TXT, PDF, PNG, JPG, MP4, or MP3.`,
    };
  }

  return { ok: true };
};

export const validateAttachmentFiles = (files = [], existingCount = 0) => {
  if (existingCount + files.length > MAX_ATTACHMENT_COUNT) {
    return {
      ok: false,
      message: "You can attach up to 5 files per event or task. Remove a file before adding more.",
      errors: [],
    };
  }

  const errors = files
    .map((file) => validateAttachment(file))
    .filter((result) => !result.ok)
    .map((result) => result.message);

  if (errors.length > 0) {
    return {
      ok: false,
      message: errors.length === 1
        ? errors[0]
        : `${errors.length} files were rejected. Each file must be DOC, DOCX, TXT, PDF, PNG, JPG, MP4, or MP3 and must not exceed 15 MB.`,
      errors,
    };
  }

  return { ok: true, errors: [] };
};

export {
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENT_COUNT,
  ACCEPTED_ATTACHMENT_TYPES,
  ACCEPTED_ATTACHMENT_MIME_TYPES,
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  ACCEPTED_ATTACHMENT_INPUT_TYPES,
};
