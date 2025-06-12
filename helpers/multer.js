import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Define fixed dimensions for images
const FIXED_WIDTH = 300;
const FIXED_HEIGHT = 300;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../public/uploads/product-images");
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only images (JPEG, JPG, PNG, WEBP) are allowed"));
  }
}

// Create the Multer instance without pre-configuring .array()
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
});

// Middleware to resize and crop images after upload
const resizeAndCropImage = async (req, file, cb) => {
  try {
    const tempPath = file.path;
    const outputPath = tempPath; // Overwrite the original file

    await sharp(tempPath)
      .resize({
        width: FIXED_WIDTH,
        height: FIXED_HEIGHT,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy
      })
      .toFile(outputPath);

    cb(null);
  } catch (error) {
    console.error("Error resizing image:", error);
    cb(new Error("Failed to process image"));
  }
};

// Middleware to process images after Multer uploads them
export const processProductImages = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const resizePromises = req.files.map(file =>
    new Promise((resolve, reject) => {
      resizeAndCropImage(req, file, (err) => {
        if (err) return reject(err);
        resolve();
      });
    })
  );

  Promise.all(resizePromises)
    .then(() => next())
    .catch(err => next(err));
};

// Profile image storage configuration
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../public/uploads/profile-images");
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "profile-" + uniqueSuffix + ext);
  }
});

// Profile image upload configuration
export const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for profile images
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
});

// Middleware to resize profile images
export const processProfileImage = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const tempPath = req.file.path;
  const outputPath = tempPath;

  sharp(tempPath)
    .resize({
      width: 200,
      height: 200,
      fit: sharp.fit.cover,
      position: sharp.strategy.entropy
    })
    .toFile(outputPath + '_temp')
    .then(() => {
      // Replace original with resized image
      fs.renameSync(outputPath + '_temp', outputPath);
      next();
    })
    .catch(err => {
      console.error("Error resizing profile image:", err);
      next(new Error("Failed to process profile image"));
    });
};

// Simple multer configuration for forms without file uploads (like address forms)
export const formDataUpload = multer();

// Export the Multer instance
