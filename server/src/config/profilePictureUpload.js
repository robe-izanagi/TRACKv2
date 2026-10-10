const multer = require('multer');
const path = require('path');

const allowedTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.get(extension) !== file.mimetype.toLowerCase()) {
      return cb(new Error('Choose a JPG, PNG, or WEBP image.'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});
