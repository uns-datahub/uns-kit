/**
 * Module dependencies.
 */
import { type Router } from "express";
import * as http from "http";
type MountConfig = {
    apiBasePrefix?: string;
    swaggerBasePrefix?: string;
    disableDefaultApiMount?: boolean;
};
export default class App {
    private expressApplication;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    private port;
    router: Router;
    private processName;
    private instanceName;
    private apiBasePrefix;
    private swaggerBasePrefix;
    swaggerSpec: {
        openapi: string;
        info: {
            title: string;
            version: string;
        };
        paths: Record<string, any>;
        servers?: Array<{
            url: string;
        }>;
    };
    private swaggerDocs;
    constructor(port: number, processName: string, instanceName: string, appContext?: any, mountConfig?: MountConfig);
    static getExternalIPv4(): string | null;
    getSwaggerSpec(): {
        openapi: string;
        info: {
            title: string;
            version: string;
        };
        paths: Record<string, any>;
        servers?: Array<{
            url: string;
        }>;
    };
    registerSwaggerDoc(path: string, doc: Record<string, unknown>): void;
    start(): Promise<void>;
}
export {};
