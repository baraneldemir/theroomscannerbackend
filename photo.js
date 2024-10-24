import mongoose from 'mongoose';
// Schema for room photos
const photoSchema = new mongoose.Schema({
    link: { type: String, required: true }, // The link where the image is scraped from
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Search' }, // Reference to the Search model
    photoUrl: { type: String, required: true }, // URL of the photo
    createdAt: { type: Date, default: Date.now }
});

// Define models
const Photo = mongoose.model('Photo', photoSchema);

export default Photo;