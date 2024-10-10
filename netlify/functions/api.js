import "dotenv/config";
import express, { Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import serverless from "serverless-http";
import chromium from '@sparticuz/chromium';

const api = express();
const router = Router();

api.use(cors());
api.use(bodyParser.json());

const scrapeImages = async (location, maxPages = 3) => {
    const results = { images: [], prices: [], titles: [] };

    try {
        const browser = await puppeteer.launch({  
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: process.env.CHROME_EXECUTABLE_PATH || (await chromium.executablePath('/var/task/node_modules/@sparticuz/chromium/bin')),
        });

        const page = await browser.newPage();
        let pageNum = 1;

        while (pageNum <= maxPages) {
            const searchURL = `https://www.spareroom.co.uk/flatshare/${location}/page${pageNum}`;
            console.log(`Scraping: ${searchURL}`);
            await page.goto(searchURL, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForSelector('figure img', { visible: true, timeout: 60000 });

            const data = await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
                const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.textContent.trim());
                const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.textContent.trim());

                return images.map((image, index) => ({
                    image,
                    price: prices[index] || 'N/A',
                    title: titles[index] || 'No Title',
                }));
            });

            data.forEach(listing => {
                results.images.push(listing.image);
                results.prices.push(listing.price);
                results.titles.push(listing.title);
            });

            const nextPageExists = await page.evaluate(() => {
                const nextButton = document.querySelector('.paginate .nextLink');
                return nextButton && !nextButton.classList.contains('disabled');
            });

            if (!nextPageExists) {
                console.log('No more pages available.');
                break; 
            }

            pageNum++;
        }

        await browser.close();
        return results;
    } catch (error) {
        console.error('Error scraping images:', error);
        throw new Error('Failed to scrape images');
    }
};

router.get('/scrape-images/:location', async (req, res) => {
    try {
        const { location } = req.params;
        const maxPages = parseInt(req.query.pages, 10) || 3;  

        console.log(`Scraping images for: ${location} up to page ${maxPages}`);

        const data = await scrapeImages(location, maxPages);
        res.json(data);  
    } catch (error) {
        console.error("Error scraping images:", error.message);
        res.status(500).json({ error: "Failed to scrape images" });
    }
});

router.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner"
    });
});

api.use("/api/", router);
export const handler = serverless(api);
