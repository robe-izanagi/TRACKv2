const path = require("path");

const defaultUploadsPath = path.join(__dirname, "..", "..", "uploads");
const configuredUploadsPath = process.env.UPLOADS_DIR?.trim();

const cloudinaryConfigured = [
  process.env.CLOUDINARY_CLOUD_NAME,
  process.env.CLOUDINARY_API_KEY,
  process.env.CLOUDINARY_API_SECRET,
].every((value) => value?.trim());

if (process.env.RENDER === "true" && !configuredUploadsPath && !cloudinaryConfigured) {
  console.warn(
    "Neither Cloudinary nor UPLOADS_DIR is configured on Render; uploads will be rejected. Configure Cloudinary or a persistent disk.",
  );
}

module.exports = path.resolve(configuredUploadsPath || defaultUploadsPath);
