const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const uploadsPath = require('../config/uploads');

const cloudinarySettings = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
};

const cloudinarySettingCount = Object.values(cloudinarySettings).filter(Boolean).length;
const isCloudinaryConfigured = cloudinarySettingCount === 3;
const isCloudinaryMisconfigured = cloudinarySettingCount > 0 && cloudinarySettingCount < 3;

if (isCloudinaryConfigured) {
  cloudinary.config({ ...cloudinarySettings, secure: true });
}

const isStorageConfigured = () =>
  isCloudinaryConfigured || Boolean(process.env.UPLOADS_DIR?.trim());

const uploadToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error('Cloudinary returned no upload result.'));
      resolve(result);
    });
    stream.end(buffer);
  });

const serializeCloudinaryReference = ({ publicId, format, resourceType, accessType }) =>
  `cloudinary://asset/${Buffer.from(JSON.stringify({
    publicId,
    format,
    resourceType,
    accessType,
  })).toString('base64url')}`;

const parseCloudinaryReference = (reference) => {
  if (typeof reference !== 'string' || !reference.startsWith('cloudinary://asset/')) {
    return null;
  }

  try {
    const encoded = reference.slice('cloudinary://asset/'.length);
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (
      typeof parsed.publicId !== 'string' ||
      !['image', 'video', 'raw'].includes(parsed.resourceType)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const parseCloudinaryImageUrl = (url) => {
  if (typeof url !== 'string') return null;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'res.cloudinary.com') return null;
    const match = parsedUrl.pathname.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return null;

    const fullPublicId = decodeURIComponent(match[2]);
    const extension = path.extname(fullPublicId);
    return {
      publicId: extension ? fullPublicId.slice(0, -extension.length) : fullPublicId,
      format: extension.slice(1) || undefined,
      resourceType: match[1],
      type: 'upload',
    };
  } catch {
    return null;
  }
};

const uploadBuffer = async (
  buffer,
  { extension = '', folder, resourceType = 'auto', accessType = 'authenticated' },
) => {
  if (isCloudinaryMisconfigured) {
    throw new Error('Cloudinary configuration is incomplete. Set cloud name, API key, and API secret.');
  }

  if (isCloudinaryConfigured) {
    const result = await uploadToCloudinary(buffer, {
      folder,
      public_id: uuidv4(),
      resource_type: resourceType,
      type: accessType,
      use_filename: false,
      unique_filename: false,
    });

    return {
      fileUrl: serializeCloudinaryReference({
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        accessType,
      }),
      publicUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      accessType,
      size: result.bytes,
    };
  }

  await fs.promises.mkdir(uploadsPath, { recursive: true });
  const filename = `${uuidv4()}${extension}`;
  await fs.promises.writeFile(path.join(uploadsPath, filename), buffer, { flag: 'wx' });
  return {
    fileUrl: `/uploads/${filename}`,
    filename,
    size: buffer.length,
  };
};

const deleteStoredFile = async (reference) => {
  const cloudinaryAsset = parseCloudinaryReference(reference) || parseCloudinaryImageUrl(reference);
  if (cloudinaryAsset) {
    const result = await cloudinary.uploader.destroy(cloudinaryAsset.publicId, {
      resource_type: cloudinaryAsset.resourceType,
      type: cloudinaryAsset.accessType || cloudinaryAsset.type || 'authenticated',
      invalidate: true,
    });
    if (!['deleted', 'not found'].includes(result.result)) {
      throw new Error(`Cloudinary did not delete the asset (${result.result || 'unknown result'}).`);
    }
    return;
  }

  if (typeof reference !== 'string' || !reference.startsWith('/uploads/')) return;
  const filename = path.basename(reference);
  try {
    await fs.promises.unlink(path.join(uploadsPath, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const getPrivateDownloadUrl = (asset) => cloudinary.utils.private_download_url(
  asset.publicId,
  asset.format,
  {
    resource_type: asset.resourceType,
    type: 'authenticated',
    attachment: true,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  },
);

module.exports = {
  deleteStoredFile,
  getPrivateDownloadUrl,
  isCloudinaryConfigured,
  isCloudinaryMisconfigured,
  isStorageConfigured,
  parseCloudinaryReference,
  uploadBuffer,
};
