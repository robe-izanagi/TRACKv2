const path = require("path");

const defaultUploadsPath = path.join(__dirname, "..", "..", "uploads");
const configuredUploadsPath = process.env.UPLOADS_DIR?.trim();

if (process.env.RENDER === "true" && !configuredUploadsPath) {
  console.warn(
    "UPLOADS_DIR is not configured on Render; attachments will use ephemeral app storage. Configure a persistent disk and set UPLOADS_DIR to its mount path.",
  );
}

module.exports = path.resolve(configuredUploadsPath || defaultUploadsPath);
