import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";
import mongoose from 'mongoose';
import Search from "./search.js";

const app = express();

app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 4000;

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Scraping function
const scrapeImages = async (location) => {
    // Check if data already exists in the database
    const existingSearches = await Search.find({ location });
    if (existingSearches.length > 0) {
        console.log(`Returning cached data from database for: ${location}`);
        return existingSearches;
    }

    const results = { images: [], prices: [], titles: [], headers: [], description: [], links: [] };

    // Puppeteer browser launch options
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--disable-software-rasterizer',
        ],
        headless: true,
    });
    const page = await browser.newPage();

    // Go to the target page
    await page.goto(`https://www.spareroom.co.uk/flatshare/${location}`);
    await page.waitForSelector('figure img', { visible: true });

    const data = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
        const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.innerText.trim());
        const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.childNodes[0].textContent.trim());
        const headers = Array.from(document.querySelectorAll('a h2')).map(h2 => h2.textContent.trim());
        const description = Array.from(document.querySelectorAll('p.description')).map(p => p.textContent.trim());
        const links = Array.from(document.querySelectorAll('a[data-detail-url]')).map(a => {
            const relativeLink = a.getAttribute('href');
            return `https://www.spareroom.co.uk${relativeLink}`;
        });

        // Combine all extracted elements into one array of objects
        return images.map((image, index) => ({
            image,
            description: description[index] || 'no description',
            price: prices[index] || 'N/A',
            title: titles[index] || 'No Title',
            link: links[index] || 'no link',
            header: headers[index] || 'no header',
        }));
    });

    // Save each listing to MongoDB and push to results
    for (const listing of data) {
        const searchEntry = new Search({
            location,
            image: listing.image,
            price: listing.price,
            title: listing.title,
            header: listing.header,
            description: listing.description,
            link: listing.link,
        });

        try {
            await searchEntry.save();
            console.log(`Saved listing for: ${listing.title}`);
        } catch (err) {
            console.error(`Error saving listing: ${err.message}`);
        }

        // Push the new listing to the results array
        results.images.push(listing.image);
        results.prices.push(listing.price);
        results.titles.push(listing.title);
        results.headers.push(listing.header);
        results.links.push(listing.link);
        results.description.push(listing.description);
    }

    // Close the browser
    await browser.close();
    return results;
};

// Route to scrape images for a given location
app.get('/scrape-images/:location', async (req, res) => {
    try {
        const { location } = req.params;
        console.log(`Scraping images for: ${location}`);
        const data = await scrapeImages(location);
        res.json(data);
    } catch (error) {
        console.error("Error scraping images:", error.message);
        res.status(500).json({ error: "Failed to scrape images" });
    }
});

// Default route for health check
app.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner right?"
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});

// Close MongoDB connection on server exit
process.on('exit', () => {
    mongoose.connection.close();
});
