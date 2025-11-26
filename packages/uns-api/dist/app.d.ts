/**
 * Module dependencies.
 */
import { type Router } from "express";
import * as http from "http";
export default class App {
    private expressApplication;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    private port;
    router: Router;
    private processName;
    private instanceName;
    swaggerSpec: {
        openapi: string;
        info: {
            title: string;
            version: string;
        };
        paths: Record<string, any>;
    };
    constructor(port: number, processName: string, instanceName: string, appContext?: any);
    static getExternalIPv4(): string | null;
    getSwaggerSpec(): {
        openapi: string;
        info: {
            title: string;
            version: string;
        };
        paths: Record<string, any>;
    };
    start(): Promise<void>;
}
