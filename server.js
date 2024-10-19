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

// Scraping function
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
            const description = Array.from(document.querySelectorAll('p.description')).map(p => p.textContent.trim());
            const links = Array.from(document.querySelectorAll('a[data-detail-url]')).map(a => a.getAttribute('href'));

            return images.map((image, index) => ({
                image,
                description: description[index] || 'no listingLocations',
                price: prices[index] || 'N/A',
                title: titles[index] || 'No Title',
                link: links[index] || 'no link',
                headers: headers[index] || 'no headers',
            }));
        });

        data.forEach(listing => {
            results.images.push(listing.image);
            results.prices.push(listing.price);
            results.titles.push(listing.title);
            results.links.push(listing.link);
            results.headers.push(listing.headers);
            results.description.push(listing.description);
        });

        await browser.close();
        return results;
    } catch (error) {
        console.error('Error scraping images:', error);
        throw new Error('Failed to scrape images');
    }
};

// Job tracking object
let jobs = {};

// Route for starting a scraping job (with job tracking)
app.get('/scrape-images/:location', async (req, res) => {
    const { location } = req.params;
    const jobId = Date.now();  // Simple job ID

    // Save initial status
    jobs[jobId] = { status: 'pending', result: null };

    // Run the scraping task
    scrapeImages(location).then(data => {
        // Update job status and result when scraping completes
        jobs[jobId].status = 'done';
        jobs[jobId].result = data;
    }).catch(error => {
        // Handle errors and mark job as failed
        jobs[jobId].status = 'failed';
        jobs[jobId].result = error.message;
    });

    // Respond with jobId for tracking
    res.json({ jobId });
});

// Route to check the status of a scraping job
app.get('/job-status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs[jobId];

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ status: job.status, result: job.result });
});
const handleFetch = async () => {
    if (location.trim().length < 3) {
        setError('Please enter a valid location (at least 3 characters).');
        return;
    }
    
    setLoading(true);
    setError('');
    
    try {
        // Start the scraping job
        const jobResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/scrape-images/${location}`);
        const jobId = jobResponse.data.jobId;
        
        // Polling function to check job status
        const checkJobStatus = async () => {
            const statusResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/job-status/${jobId}`);
            if (statusResponse.data.status === 'done') {
                setImages(statusResponse.data.result.images);
                setTitles(statusResponse.data.result.titles);
                setHeaders(statusResponse.data.result.headers);
                setPrices(statusResponse.data.result.prices);
                setLinks(statusResponse.data.result.links);
                setDescription(statusResponse.data.result.description);
                clearInterval(polling); // Stop polling
            } else if (statusResponse.data.status === 'failed') {
                setError(statusResponse.data.result); // Set the error message
                clearInterval(polling); // Stop polling
            }
        };
        
        const polling = setInterval(checkJobStatus, 1000); // Check every second
    } catch (error) {
        console.error("Error fetching data:", error);
        setError(error.response?.data?.error || 'Failed to load rooms :(');
    } finally {
        setLoading(false);
    }
};


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
