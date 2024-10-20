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
    const existingSearches = await Search.find({ location });

    if (existingSearches.length > 0) {
        console.log(`Returning cached data from database for: ${location}`);
        return existingSearches;
    }

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
    await page.goto(`https://www.spareroom.co.uk/flatshare/${location}`);
    await page.waitForSelector('figure img', { visible: true });

    const data = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
        const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.innerText.trim());
        const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.childNodes[0].textContent.trim());
        const headers = Array.from(document.querySelectorAll('a h2')).map(h2 => h2.textContent.trim());
        const descriptions = Array.from(document.querySelectorAll('p.description')).map(p => p.textContent.trim());
        const links = Array.from(document.querySelectorAll('a[data-detail-url]')).map(a => `https://www.spareroom.co.uk${a.getAttribute('href')}`);

        return images.map((image, index) => ({
            image,
            description: descriptions[index] || 'no description',
            price: prices[index] || 'N/A',
            title: titles[index] || 'No Title',
            link: links[index] || 'no link',
            header: headers[index] || 'no header',
        }));
    });

    const listings = [];

    for (const listing of data) {
        const searchEntry = new Search({
            location,
            image: listing.image,
            price: listing.price,
            title: listing.title,
            header: listing.header,
            description: listing.description,
            link: listing.link,
            scrapedAt: new Date() // Add scrapedAt timestamp
        });

        await searchEntry.save()
            .then(savedListing => {
                console.log(`Saved listing for: ${listing.title}`);
                listings.push(savedListing); // Store each saved listing in an array
            })
            .catch(err => console.error(`Error saving listing: ${err.message}`));
    }

    await browser.close();
    return listings; // Return array of saved listings
};

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

// Default route for basic health check
app.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner right?"
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});

process.on('exit', () => {
    mongoose.connection.close();
});
