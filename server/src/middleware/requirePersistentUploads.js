const fileStorage = require('../services/fileStorage');

module.exports = (req, res, next) => {
  if (fileStorage.isCloudinaryMisconfigured) {
    return res.status(503).json({
      ok: false,
      message: 'File uploads are temporarily unavailable because Cloudinary storage is not fully configured. Contact the system administrator.',
    });
  }

  if (process.env.RENDER === 'true' && !fileStorage.isStorageConfigured()) {
    return res.status(503).json({
      ok: false,
      message: 'File uploads are temporarily unavailable because persistent storage is not configured. Contact the system administrator.',
    });
  }

  next();
};
