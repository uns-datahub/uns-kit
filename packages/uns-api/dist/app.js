/**
 * Module dependencies.
 */
import express from "express";
import * as http from "http";
import * as path from "path";
import cookieParser from "cookie-parser";
import { basePath } from "@uns-kit/core/base-path.js";
import logger from "@uns-kit/core/logger.js";
import os from 'os';
const normalizeBasePrefix = (value) => {
    if (!value)
        return "";
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeading.replace(/\/+$/, "");
};
const buildSwaggerPath = (base, processName, instanceName) => {
    const processSegment = `/${processName}`;
    let baseWithProcess = base || "/";
    if (!baseWithProcess.endsWith(processSegment)) {
        baseWithProcess = `${baseWithProcess}${processSegment}`;
    }
    return `${baseWithProcess}/${instanceName}/swagger.json`.replace(/\/{2,}/g, "/");
};
export default class App {
    expressApplication;
    server;
    port;
    router;
    processName;
    instanceName;
    apiBasePrefix;
    swaggerBasePrefix;
    swaggerSpec;
    swaggerDocs = new Map();
    constructor(port, processName, instanceName, appContext, mountConfig) {
        this.router = express.Router();
        this.port = port;
        this.expressApplication = express();
        this.server = http.createServer(this.expressApplication);
        this.processName = processName;
        this.instanceName = instanceName;
        this.apiBasePrefix =
            normalizeBasePrefix(mountConfig?.apiBasePrefix ?? process.env.UNS_API_BASE_PATH) || "/api";
        const rawSwaggerBase = normalizeBasePrefix(mountConfig?.swaggerBasePrefix ?? process.env.UNS_SWAGGER_BASE_PATH) ||
            this.apiBasePrefix;
        // If someone passed ".../api" as swagger base, strip that to avoid duplicated segments
        this.swaggerBasePrefix = rawSwaggerBase.endsWith("/api")
            ? rawSwaggerBase.replace(/\/api\/?$/, "") || "/"
            : rawSwaggerBase;
        // Add context
        this.expressApplication.use((req, _res, next) => {
            req.appContext = appContext;
            next();
        });
        // Body parser (req.body)
        this.expressApplication.use(express.json());
        this.expressApplication.use(express.urlencoded({ extended: false }));
        // Add cookie parser
        this.expressApplication.use(cookieParser());
        // Static / public folder
        const publicHome = process.env.PUBLIC_HOME === null || process.env.PUBLIC_HOME === undefined
            ? "public"
            : process.env.PUBLIC_HOME;
        this.expressApplication.use(express.static(path.join(basePath, publicHome)));
        // Map routes
        this.router.use((_req, _res, next) => {
            logger.info("Time: ", Date.now());
            next();
        });
        if (!mountConfig?.disableDefaultApiMount) {
            this.expressApplication.use(this.apiBasePrefix, this.router);
        }
        // Swagger specs
        this.swaggerSpec = {
            openapi: "3.0.0",
            info: {
                title: "UNS API",
                version: "1.0.0",
            },
            paths: {},
            servers: this.swaggerBasePrefix ? [{ url: this.swaggerBasePrefix }] : undefined,
        };
    }
    static getExternalIPv4() {
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
    getSwaggerSpec() {
        return this.swaggerSpec;
    }
    registerSwaggerDoc(path, doc) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        this.swaggerDocs.set(normalizedPath, doc);
        this.expressApplication.get(normalizedPath, (_req, res) => res.json(doc));
    }
    async start() {
        // Listen on provided port, on all network interfaces.
        this.server.listen(this.port);
        this.server.on("error", (error) => {
            if (error.syscall !== "listen") {
                throw error;
            }
            const bind = typeof this.port === "string"
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
            let ip;
            let port;
            if (addressInfo && typeof addressInfo === "object") {
                ip = App.getExternalIPv4();
                port = addressInfo.port;
            }
            else if (typeof addressInfo === "string") {
                ip = App.getExternalIPv4();
                port = "";
            }
            logger.info(`API listening on http://${ip}:${port}${this.apiBasePrefix}`);
            const swaggerPath = buildSwaggerPath(this.swaggerBasePrefix, this.processName, this.instanceName);
            logger.info(`Swagger openAPI on http://${ip}:${port}${swaggerPath}`);
            this.expressApplication.get(swaggerPath, (req, res) => res.json(this.getSwaggerSpec()));
        });
    }
}
