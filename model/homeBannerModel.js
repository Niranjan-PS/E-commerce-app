import mongoose from 'mongoose';

const homeBannerSchema = new mongoose.Schema({
    imageUrl: {
        type: String,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('HomeBanner', homeBannerSchema);