import mongoose from 'mongoose';

// Schema for room listings (search results)
const searchSchema = new mongoose.Schema({
    location: { type: String, required: true },
    image: { type: String },
    price: { type: String },
    title: { type: String },
    header: { type: String },
    description: { type: String },
    link: { type: String, required: true },  // The room listing link
    scrapedAt: { type: Date, default: Date.now },
    page: { type: Number }
});


const Search = mongoose.model('Search', searchSchema);

// Exporting models
export default Search;
