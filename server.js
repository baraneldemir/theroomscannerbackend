import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import chromium from '@sparticuz/chromium';

const app = express();

app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 4000;

const scrapeImages = async (location) => {
    const results = { images: [], links: [], description: [], prices: [], titles: [], headers: [] };

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), // Ensure this path is correct
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);

        const searchURL = `https://www.spareroom.co.uk/flatshare/${location}`;
        console.log(`Scraping: ${searchURL}`);
        
        await page.goto(searchURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('strong.listingPrice', { timeout: 10000 });

        const data = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
            const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.innerText.trim());
            const headers = Array.from(document.querySelectorAll('a[data-detail-url] h2')).map(h2 => h2.innerText.trim());
            const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.childNodes[0].textContent.trim());
            // const listingLocations = Array.from(document.querySelectorAll('span.listingLocation')).map(span => span.textContent.trim());
            const description = Array.from(document.querySelectorAll('p.description')).map(p => p.textContent.trim());
            const links = Array.from(document.querySelectorAll('a[data-detail-url]')).map(a => a.getAttribute('href'));

            return images.map((image, index) => ({
                image,
                description: description[index] || 'no listingLocations',
                price: prices[index] || 'N/A',
                title: titles[index] || 'No Title',
                link: links[index] || 'no link',
                headers: headers[index] || 'no headers',
                // listingLocations: listingLocations[index] || 'no listingLocations'
            }));
        });

        data.forEach(listing => {
            results.images.push(listing.image);
            results.prices.push(listing.price);
            results.titles.push(listing.title);
            results.links.push(listing.link);
            results.headers.push(listing.headers);
            results.description.push(listing.description);
            // results.listingLocations.push(listing.listingLocations);
        });

        await browser.close();
        return results;
    } catch (error) {
        console.error('Error scraping images:', error); // More logging
        throw new Error('Failed to scrape images');
    }
};


let jobs = {};

app.get('/scrape-images/:location', async (req, res) => {
    const { location } = req.params;
    const jobId = Date.now();  // Simple job ID

    // Save initial status
    jobs[jobId] = { status: 'pending', result: null };

    scrapeImages(location).then(data => {
        // Update job status and result when scraping completes
        jobs[jobId].status = 'done';
        jobs[jobId].result = data;
    }).catch(error => {
        // Handle errors and mark job as failed
        jobs[jobId].status = 'failed';
        jobs[jobId].result = error.message;
    });

    res.json({ jobId });
});

app.get('/job-status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs[jobId];

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ status: job.status, result: job.result });
});


app.get('/scrape-images/:location', async (req, res) => {
    try {
        const { location } = req.params;

        console.log(`Scraping images for: ${location}`);

        const data = await scrapeImages(location);
        res.json(data);  // Send images, prices, and titles as JSON
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
        message: "Backend Working RoomScanner right?"
    });
});
