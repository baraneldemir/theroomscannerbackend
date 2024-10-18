import "dotenv/config";
import express, { Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import chromium from '@sparticuz/chromium';
import serverless from "serverless-http";

const api = express();
const router = Router();

api.use(cors());
api.use(bodyParser.json());

// Allow CORS for the frontend
const allowedOrigins = ["https://theroomscanner.com"];
api.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
const gotoWithRetry = async (page, url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
            return;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === retries - 1) throw error; // Rethrow on last attempt
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
        }
    }
};

// Use the retry function
await gotoWithRetry(page, searchURL);

const scrapeImages = async (location) => {
    const results = { images: [], links: [], description: [], prices: [], titles: [] };

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1280,800',
                '--disable-extensions'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
        });

        browser.on('disconnected', () => {
            console.error('Browser disconnected');
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(120000); // Increase timeout to 2 minutes

        const searchURL = `https://www.spareroom.co.uk/flatshare/${location}`;
        console.log(`Scraping: ${searchURL}`);

        // Log any console messages from the page
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

        await gotoWithRetry(page, searchURL); // Use the retry function

        await page.waitForSelector('figure img', { visible: true, timeout: 120000 });

        const data = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
            const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.innerText.trim());
            const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.childNodes[0].textContent.trim());
            const description = Array.from(document.querySelectorAll('p.description')).map(p => p.textContent.trim());
            const links = Array.from(document.querySelectorAll('a[data-detail-url]')).map(a => a.getAttribute('href'));

            return images.map((image, index) => ({
                image,
                description: description[index] || 'No description',
                price: prices[index] || 'N/A',
                title: titles[index] || 'No Title',
                link: links[index] || 'No link',
            }));
        });

        data.forEach(listing => {
            results.images.push(listing.image);
            results.prices.push(listing.price);
            results.titles.push(listing.title);
            results.links.push(listing.link);
            results.description.push(listing.description);
        });

        await browser.close();
        return results;
    } catch (error) {
        console.error('Error scraping images:', error); 
        throw new Error(`Failed to scrape images: ${error.message}`);
    }
};



// CORS preflight response for OPTIONS requests
router.options('/scrape-images/:location', cors());

router.get('/scrape-images/:location', async (req, res) => {
    try {
        const { location } = req.params;
        console.log(`Scraping images for: ${location}`);

        const data = await scrapeImages(location);
        res.json(data);
    } catch (error) {
        console.error("Error scraping images:", error.message);
        res.status(500).json({ error: `Failed to scrape images: ${error.message}` }); // Return the error message
    }
});

// Health check route
router.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner"
    });
});
api.use("/api", router);

// Error handling for 404
api.use((req, res) => {
    res.status(404).send('Not Found');
});

// Export the handler for Netlify
export const handler = serverless(api);