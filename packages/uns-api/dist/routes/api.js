import express from "express";
import multer from "multer";
import logger from "@uns-kit/core/logger.js";
export default class Api {
    router;
    upload;
    constructor() {
        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, "tmp/");
            },
            filename: function (req, file, cb) {
                const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
                cb(null, file.fieldname + "-" + uniqueSuffix + ".jpg");
            },
        });
        this.upload = multer({ storage: storage });
        this.router = express.Router();
        this.router.use((req, res, next) => {
            logger.info("Time: ", Date.now());
            next();
        });
        /**
         * Open for all
         *
         * Example post request
         */
        this.router.post("/call", async function (req, res) {
            try {
                const appContext = req.appContext;
                res.send("OK");
            }
            catch (error) {
                res.status(400).send("Error");
            }
        });
        /**
         * Open for all
         *
         * Upload files
         */
        this.router.post("/upload", this.upload.single("file"), function (req, res) {
            const appContext = req.appContext;
            logger.info(req.file);
            res.send("Successfully uploaded files");
        });
    }
}
