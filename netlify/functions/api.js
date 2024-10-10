import "dotenv/config";
import express, { Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import serverless from "serverless-http"

const api = express();

api.use(cors());
api.use(bodyParser.json());



const router = Router()

router.get('/', (req, res) => {
    res.json({
        message: "Backend Working RoomScanner"
    });
});


api.use("/api/", router)

export const handler = serverless(api)
