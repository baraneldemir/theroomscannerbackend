import "dotenv/config";
import express, { Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
// import puppeteer from "puppeteer";
import serverless from "serverless-http"

const api = express();

api.use(cors());
api.use(bodyParser.json());

const port = process.env.PORT || 4000;

const router = Router()

// const scrapeImages = async (location, maxPages = 3) => {
//     const results = { images: [], prices: [], titles: [] };

//     try {
//         const browser = await puppeteer.launch({ headless: true });
//         const page = await browser.newPage();

//         let pageNum = 1;

//         while (pageNum <= maxPages) {
//             const searchURL = `https://www.spareroom.co.uk/flatshare/${location}/page${pageNum}`;
//             console.log(`Scraping: ${searchURL}`);
//             await page.goto(searchURL, { waitUntil: 'networkidle2' });

//             // Wait for the listings to load
//             await page.waitForSelector('figure img', { visible: true });

//             // Scrape data from the page
//             const data = await page.evaluate(() => {
//                 const images = Array.from(document.querySelectorAll('figure img')).map(img => img.src);
//                 const prices = Array.from(document.querySelectorAll('strong.listingPrice')).map(strong => strong.textContent.trim());
//                 const titles = Array.from(document.querySelectorAll('em.shortDescription')).map(em => em.textContent.trim());

//                 // Ensure that all arrays have the same length (filter out incomplete listings)
//                 const listings = [];
//                 for (let i = 0; i < Math.min(images.length, prices.length, titles.length); i++) {
//                     listings.push({
//                         image: images[i],
//                         price: prices[i],
//                         title: titles[i]
//                     });
//                 }
//                 return listings;
//             });

//             // Append the results
//             data.forEach(listing => {
//                 results.images.push(listing.image);
//                 results.prices.push(listing.price);
//                 results.titles.push(listing.title);
//             });

//             // Check if the "Next" button exists on the page
//             const nextPageExists = await page.evaluate(() => {
//                 const nextButton = document.querySelector('.paginate .nextLink');
//                 return nextButton && !nextButton.classList.contains('disabled');
//             });

//             if (!nextPageExists) {
//                 console.log('No more pages available.');
//                 break; // Exit the loop if there's no next page
//             }

//             console.log(`Moving to page ${pageNum + 1}`);
//             pageNum++;
//         }

//         await browser.close();
//         return results;
//     } catch (error) {
//         console.error('Error scraping images:', error);
//         throw new Error('Failed to scrape images');
//     }
// };


// router.get('/scrape-images/:location', async (req, res) => {
//     try {
//         // const { location } = req.params;
//         // const maxPages = parseInt(req.query.pages, 10) || 3;  // Number of pages to scrape, default to 3

//         // console.log(`Scraping images for: ${location} up to page ${maxPages}`);

//         // const data = await scrapeImages(location, maxPages);
//         // res.json(data);  // Send images, prices, and titles as JSON
//     } catch (error) {
//         console.error("Error scraping images:", error.message);
//         res.status(500).json({ error: "Failed to scrape images" });
//     }
// });


router.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner"
    });
});


api.use("/api/", router)

export const handler = serverless(api)
