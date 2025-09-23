import { createLogger, format, transports } from 'winston';
const logger = createLogger({
    level: 'info', // Default logging level
    format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.errors({ stack: true }), // Include stack trace
    format.splat(), format.json()),
    transports: [
        new transports.Console(), // Log to console only
        // Remove the file transports to prevent logging to files
        // new transports.File({ filename: 'logs/error.log', level: 'error' }), 
        // new transports.File({ filename: 'logs/combined.log' })
    ],
    exceptionHandlers: [
        new transports.Console(), // Log exceptions to console
        // Remove exception logging to file
        // new transports.File({ filename: 'logs/exceptions.log' })
    ]
});
export default logger;
//# sourceMappingURL=logger.js.map