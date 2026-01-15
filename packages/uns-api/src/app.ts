/**
 * Module dependencies.
 */
import express, { type Application, type NextFunction, type Request, type Response, type Router } from "express";
import * as http from "http";
import * as path from "path";
import cookieParser from "cookie-parser";
import { basePath } from "@uns-kit/core/base-path.js";
import logger from "@uns-kit/core/logger.js";
import os from 'os';

export default class App {
  private expressApplication: Application;
  public server;
  private port;
  public router: Router;
  private processName: string;
  private instanceName: string;
  public swaggerSpec: {
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, any>;
  };
  private swaggerDocs: Map<string, Record<string, unknown>> = new Map();



  constructor(port: number, processName: string, instanceName: string, appContext?: any) {
    this.router = express.Router();
    this.port = port;
    this.expressApplication = express();
    this.server = http.createServer(this.expressApplication);
    this.processName = processName;
    this.instanceName = instanceName;

    // Add context
    this.expressApplication.use((req: any, _res: Response, next: NextFunction) => {
      req.appContext = appContext;
      next();
    });

    // Body parser (req.body)
    this.expressApplication.use(express.json());
    this.expressApplication.use(express.urlencoded({ extended: false }));

    // Add cookie parser
    this.expressApplication.use(cookieParser());

    // Static / public folder
    const publicHome =
      process.env.PUBLIC_HOME === null || process.env.PUBLIC_HOME === undefined
        ? "public"
        : process.env.PUBLIC_HOME;
    this.expressApplication.use(
      express.static(path.join(basePath, publicHome))
    );

    // Map routes
    this.router.use(
      (
        _req: Request,
        _res: Response,
        next: NextFunction
      ) => {
        logger.info("Time: ", Date.now());
        next();
      }
    );    
    this.expressApplication.use("/api", this.router);

    // Swagger specs
    this.swaggerSpec = {
      openapi: "3.0.0",
      info: {
        title: "UNS API",
        version: "1.0.0",
      },
      paths: {},
    };    
  }

  public static getExternalIPv4(): string | null {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return null;
  }


  public getSwaggerSpec() {
    return this.swaggerSpec;
  }

  public registerSwaggerDoc(path: string, doc: Record<string, unknown>): void {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    this.swaggerDocs.set(normalizedPath, doc);
    this.expressApplication.get(normalizedPath, (_req: any, res: any) => res.json(doc));
  }

  public async start() {
    // Listen on provided port, on all network interfaces.
    this.server.listen(this.port);
    this.server.on("error", (error: { syscall: string; code: any }) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind =
        typeof this.port === "string"
          ? `Pipe ${this.port}`
          : `Port ${this.port}`;

      // handle specific listen errors with friendly messages
      switch (error.code) {
        case "EACCES":
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
    this.server.on("listening", () => {
      App.bind(this);
      const addressInfo = this.server.address();
      let ip: string | undefined;
      let port: number | string | undefined;
      if (addressInfo && typeof addressInfo === "object") {
        ip = App.getExternalIPv4();
        port = addressInfo.port;
      } else if (typeof addressInfo === "string") {
        ip = App.getExternalIPv4();
        port = "";
      }
      logger.info(`API listening on http://${ip}:${port}/api`);
      logger.info(`Swagger openAPI on http://${ip}:${port}/${this.processName}/${this.instanceName}/swagger.json`);

      this.expressApplication.get(`/${this.processName}/${this.instanceName}/swagger.json`, (req: any, res: any) => res.json(this.getSwaggerSpec()));
    });
  }

}
