import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";
import mongoose from 'mongoose';
import Search from "./search.js";
import Photo from "./photo.js";


const app = express();

app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 4000;

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Scraping function
const scrapeImages = async (location, page = 1, minPrice, maxPrice) => {
    const existingSearches = await Search.find({ location, page });

    if (existingSearches.length > 0) {
        console.log(`Returning cached data from database for: ${location} on page ${page}`);
        const filteredResults = existingSearches.filter(listing => {
            const price = parseFloat(listing.price.replace(/[^0-9.]/g, ''));
            return (!minPrice || price >= minPrice) && (!maxPrice || price <= maxPrice);
        });

        return filteredResults; // Return filtered cached data
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

    const pageUrl = `https://www.spareroom.co.uk/flatshare/${location}/page${page}`;
    const pageInstance = await browser.newPage();
    await pageInstance.goto(pageUrl);

    // await pageInstance.waitForSelector('.listing-result figure img', { visible: true });

    const data = await pageInstance.evaluate(() => {
        const listings = Array.from(document.querySelectorAll('.listing-result')).map(listing => {
            let image = 'no image found';
            
            // Check if a video is available
            const videoContainer = listing.querySelector('.has-video');
            if (videoContainer) {
                // Extract the background image from the video container
                image = videoContainer.style.backgroundImage.replace(/url\(["']?/, '').replace(/["']?\)$/, '');
            } else {
                // Extract the normal image if no video is found
                const imgElement = listing.querySelector('figure img');
                if (imgElement) {
                    image = imgElement.src;
                }
            }
    
            const price = listing.querySelector('.listingPrice') ? listing.querySelector('.listingPrice').innerText.trim() : 'N/A';
            const header = listing.querySelector('h2') ? listing.querySelector('h2').innerText.trim() : 'No Title';
            const description = listing.querySelector('.description') ? listing.querySelector('.description').innerText.trim() : 'no description';
            const link = listing.querySelector('a[data-detail-url]') ? `https://www.spareroom.co.uk${listing.querySelector('a[data-detail-url]').getAttribute('href')}` : 'no link';
            const title = listing.querySelector('em') ? listing.querySelector('em').childNodes[0].textContent.trim() : 'No Header';
            
            return {
                image,
                price,
                title,
                description,
                link,
                header
            };
        });
    
        return listings; // Return the complete listings array
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
            scrapedAt: new Date(),
            page: page // Save the current page number
        });

        await searchEntry.save()
            .then(savedListing => {
                console.log(`Saved listing for: ${listing.title}`);
                listings.push(savedListing);
            })
            .catch(err => console.error(`Error saving listing: ${err.message}`));
    }

    const filteredResults = listings.filter(listing => {
        const price = parseFloat(listing.price.replace(/[^0-9.]/g, ''));
        return (!minPrice || price >= minPrice) && (!maxPrice || price <= maxPrice);
    });

    await browser.close();

    return filteredResults;
};

const scrapePhotos = async (link) => {
    // Check if the listing already exists in the database
    const existingListing = await Search.findOne({ link });

    if (!existingListing) {
        console.error('No associated listing found for the link:', link);
        return [];
    }

    // Check if photos already exist for this listing
    const existingPhotos = await Photo.find({ roomId: existingListing._id });

    if (existingPhotos.length > 0) {
        console.log(`Returning cached photos for: ${link}`);
        return existingPhotos; // Return the cached photos
    }

    // If no photos are found in the cache, proceed with scraping
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

    const pageInstance = await browser.newPage();
    await pageInstance.goto(link);

    const photos = await pageInstance.evaluate(() => {
        const photoLinks = [];
        document.querySelectorAll('.photo-gallery__thumbnail-link').forEach(el => {
            const photoUrl = el.getAttribute('href');
            if (photoUrl) {
                photoLinks.push(photoUrl);
            }
        });
        return photoLinks;
    });

    await browser.close();

    // Save each photo to the database
    const savedPhotos = [];
    for (const photoUrl of photos) {
        const photoEntry = new Photo({
            link, // The link where the image is scraped from
            roomId: existingListing._id, // Reference to the Search model
            photoUrl, // URL of the photo
        });

        await photoEntry.save()
            .then(savedPhoto => {
                console.log(`Saved photo for: ${link}`);
                savedPhotos.push(savedPhoto);
            })
            .catch(err => console.error(`Error saving photo: ${err.message}`));
    }

    return savedPhotos; // Return the newly saved photos
};



app.get('/scrape-photos', async (req, res) => {
    try {
        const link = req.query.link;
        if (!link) {
            return res.status(400).json({ error: "Link parameter is required" });
        }
        console.log(`Scraping photos for: ${link}`);

        const photos = await scrapePhotos(link);
        res.json(photos);
    } catch (error) {
        console.error("Error scraping photos:", error.message);
        res.status(500).json({ error: "Failed to scrape photos" });
    }
});

// scrapePhotos('https://www.spareroom.co.uk/flatshare/greater_manchester/salford/17536087')
//     .then(photos => console.log(photos))
//     .catch(err => console.error(err));

// Modify your route to accept page parameter
app.get('/scrape-images/:location/:page?', async (req, res) => {
    try {
        const { location, page } = req.params;
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);

        console.log(`Scraping images for: ${location} on page ${page || 1}`);

        const data = await scrapeImages(location, parseInt(page) || 1, minPrice, maxPrice);
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
