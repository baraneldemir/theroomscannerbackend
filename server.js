import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import chromium from '@sparticuz/chromium';

const app = express();

// Allow CORS for the frontend
const allowedOrigins = ["https://theroomscanner.com"];  // Replace with your frontend URL
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(bodyParser.json());

const port = process.env.PORT || 4000;

const scrapeImages = async (location) => {
    const results = { images: [], links: [], description: [], prices: [], titles: [] };

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);

        const searchURL = `https://www.spareroom.co.uk/flatshare/${location}`;
        console.log(`Scraping: ${searchURL}`);
        
        await page.goto(searchURL, { waitUntil: 'networkidle2', timeout: 0 });
        await page.waitForSelector('figure img', { visible: true, timeout: 0 });

        const data = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
            const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.innerText.trim());
            const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.childNodes[0].textContent.trim());
            const description = Array.from(document.querySelectorAll('p.description')).map(p => p.textContent.trim());
            const links = Array.from(document.querySelectorAll('a[data-detail-url]')).map(a => a.getAttribute('href'));

            return images.map((image, index) => ({
                image,
                description: description[index] || 'no description',
                price: prices[index] || 'N/A',
                title: titles[index] || 'No Title',
                link: links[index] || 'no link',
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
        throw new Error('Failed to scrape images');
    }
};

// CORS preflight response for OPTIONS requests
app.options('/scrape-images/:location', cors());

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

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});

app.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner"
    });
});
