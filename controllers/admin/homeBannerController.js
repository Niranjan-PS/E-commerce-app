import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import HomeBanner from '../../model/homeBannerModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for banner upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../public/uploads/banner');
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'home-banner-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Upload or replace home banner
const uploadHomeBanner = async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        // Get the uploaded file path (relative to public folder)
        const imageUrl = `/uploads/banner/${req.file.filename}`;

        // Check if there's an existing banner
        const existingBanner = await HomeBanner.findOne();

        if (existingBanner) {
            // Delete old image file if it exists
            const oldImagePath = path.join(__dirname, '../../public', existingBanner.imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }

            // Update existing banner
            existingBanner.imageUrl = imageUrl;
            existingBanner.uploadedAt = new Date();
            await existingBanner.save();
        } else {
            // Create new banner record
            const newBanner = new HomeBanner({
                imageUrl: imageUrl
            });
            await newBanner.save();
        }

        res.json({
            success: true,
            message: 'Home banner uploaded successfully',
            imageUrl: imageUrl
        });

    } catch (error) {
        console.error('Error uploading home banner:', error);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            const filePath = req.file.path;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload home banner',
            error: error.message
        });
    }
};

// Get current home banner
const getHomeBanner = async (req, res) => {
    try {
        const banner = await HomeBanner.findOne().sort({ uploadedAt: -1 });
        
        if (!banner) {
            return res.json({
                success: true,
                banner: null,
                message: 'No home banner found'
            });
        }

        res.json({
            success: true,
            banner: {
                imageUrl: banner.imageUrl,
                uploadedAt: banner.uploadedAt
            }
        });

    } catch (error) {
        console.error('Error fetching home banner:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch home banner',
            error: error.message
        });
    }
};

// Render admin home banner management page
const renderHomeBannerPage = async (req, res) => {
    try {
        const banner = await HomeBanner.findOne().sort({ uploadedAt: -1 });
        
        res.render('admin/home-banner', {
            title: 'Home Banner Management',
            banner: banner
        });

    } catch (error) {
        console.error('Error rendering home banner page:', error);
        res.status(500).render('admin/error', {
            message: 'Failed to load home banner page'
        });
    }
};

export {
    upload,
    uploadHomeBanner,
    getHomeBanner,
    renderHomeBannerPage
};