import "dotenv/config";
import express, { Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import chromium from '@sparticuz/chromium';
import serverless from "serverless-http";

const api = express();

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

const router = Router();

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
                '--window-size=1280,800'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
        });

        browser.on('disconnected', () => {
            console.error('Browser disconnected');
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(60000); // Set navigation timeout to 60 seconds

        const searchURL = `https://www.spareroom.co.uk/flatshare/${location}`;
        console.log(`Scraping: ${searchURL}`);

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');

        try {
            await page.goto(searchURL, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (gotoError) {
            console.error('Error during navigation:', gotoError);
            throw new Error(`Failed to navigate to the page: ${gotoError.message}`);
        }

        await page.waitForSelector('figure img', { visible: true, timeout: 60000 });

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

api.use("/api/", router);

export const handler = serverless(api);
