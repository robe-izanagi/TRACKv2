const multer = require('multer');
const path = require('path');

const fileFilter = (req, file, cb) => {
  const allowed = /\.(docx?|txt|pdf|png|jpe?g|mp4|mp3)$/i;
  if (allowed.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Only DOC, DOCX, TXT, PDF, PNG, JPG, MP4, and MP3 files are accepted.',
      ),
    );
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});

module.exports = upload;