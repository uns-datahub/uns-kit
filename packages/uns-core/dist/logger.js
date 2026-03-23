import { createLogger, format, transports } from 'winston';
import GelfTransport from 'winston-gelf';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ConfigFile } from './config-file.js';
function loadPackageMeta() {
    const packageJsonPaths = [
        path.join(process.cwd(), 'package.json'),
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
    ];
    for (const packageJsonPath of packageJsonPaths) {
        try {
            const raw = fs.readFileSync(packageJsonPath, 'utf8');
            const packageMeta = JSON.parse(raw);
            if (packageMeta.name || packageMeta.version) {
                return packageMeta;
            }
        }
        catch {
            // Try the next candidate.
        }
    }
    return {};
}
function loadLoggingConfig() {
    try {
        return ConfigFile.loadRawConfig().logging;
    }
    catch {
        return undefined;
    }
}
const packageMeta = loadPackageMeta();
const loggingConfig = loadLoggingConfig();
const loggerTransports = [
    new transports.Console()
];
if (loggingConfig) {
    loggerTransports.push(new GelfTransport({
        gelfPro: {
            adapterName: loggingConfig.adapter,
            adapterOptions: {
                host: loggingConfig.host,
                port: loggingConfig.port
            }
        }
    }));
}
const logger = createLogger({
    level: 'info', // Default logging level
    // 👇 Global fields for ALL transports (console + GELF)
    defaultMeta: {
        service: packageMeta.name ?? 'unknown-service',
        version: packageMeta.version ?? 'unknown',
        environment: process.env.NODE_ENV || 'unknown',
        hostname: os.hostname()
    },
    format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.errors({ stack: true }), // Include stack trace
    format.splat(), format.json()),
    transports: loggerTransports,
    exceptionHandlers: [
        new transports.Console(), // Log exceptions to console
        // Remove exception logging to file
        // new transports.File({ filename: 'logs/exceptions.log' })
    ]
});
export function getLogger(modulePath) {
    const normalizedModulePath = modulePath.startsWith('file:')
        ? fileURLToPath(modulePath)
        : modulePath;
    const relativePath = path.relative(process.cwd(), normalizedModulePath);
    const withoutExt = relativePath.replace(/\.[^/.]+$/, '');
    const dotted = withoutExt.split(path.sep).join('.');
    return logger.child({
        facility: dotted
    });
}
export default logger;
//# sourceMappingURL=logger.js.map