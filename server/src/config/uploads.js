const path = require("path");

const defaultUploadsPath = process.env.RENDER === "true"
  ? "/var/data/uploads"
  : path.join(__dirname, "..", "..", "uploads");

module.exports = path.resolve(process.env.UPLOADS_DIR || defaultUploadsPath);
