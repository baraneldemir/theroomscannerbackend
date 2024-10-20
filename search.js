import mongoose from 'mongoose';

const searchSchema = new mongoose.Schema({
    location: { type: String, required: true },
    image: { type: String },
    price: { type: String },
    title: { type: String },
    header: { type: String },
    description: { type: String },
    link: { type: String },
    scrapedAt: { type: Date, default: Date.now },
    page: {type: Number}
});

const Search = mongoose.model('Search', searchSchema);

export default Search;
