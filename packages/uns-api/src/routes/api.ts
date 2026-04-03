import express, { type NextFunction, type Request, type Response, type Router } from "express";
import multer from "multer";
import logger from "@uns-kit/core/logger.js";


export default class Api {
  public router: Router;
  private upload: any;

  constructor() {
    const storage = multer.diskStorage({
      destination: function (req: any, file: any, cb: (error: any, destination: string) => void) {
        cb(null, "tmp/");
      },
      filename: function (req: any, file: any, cb: (error: any, filename: string) => void) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + ".jpg");
      },
    });

    this.upload = multer({ storage: storage });

    this.router = express.Router();
    this.router.use(
      (
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        logger.info("Time: ", Date.now());
        next();
      }
    );


    /**
     * Open for all
     * 
     * Example post request
     */
    this.router.post("/call", async function (req: any, res: Response) {
      try {
        const appContext = req.appContext;
        res.send("OK");
      } catch (error) {
        res.status(400).send("Error");
      }
    });


    /**
     * Open for all
     * 
     * Upload files
     */
    this.router.post(
      "/upload",
      this.upload.single("file"),
      function (req: any, res: Response) {
        const appContext = req.appContext;
        logger.info(req.file);
        res.send("Successfully uploaded files");
      }
    );
  }
}
