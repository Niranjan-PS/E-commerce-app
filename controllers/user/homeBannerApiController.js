import HomeBanner from '../../model/homeBannerModel.js';

// Public API to get current home banner
const getHomeBannerApi = async (req, res) => {
    try {
        const banner = await HomeBanner.findOne().sort({ uploadedAt: -1 });
        
        if (!banner) {
            return res.json({
                success: true,
                imageUrl: null,
                message: 'No home banner available'
            });
        }

        res.json({
            success: true,
            imageUrl: banner.imageUrl,
            uploadedAt: banner.uploadedAt
        });

    } catch (error) {
        console.error('Error fetching home banner API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch home banner',
            error: error.message
        });
    }
};

export {
    getHomeBannerApi
};