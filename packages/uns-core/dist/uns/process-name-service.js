import { readFileSync, writeFileSync } from "fs";
import { PROCESS_NAME_FILE } from "./process-config.js";
import logger from "../logger.js";
/**
 * Retrieves a persistent process name.
 * - Checks if a process name is provided via command-line args.
 * - Otherwise, reads the process name from a file.
 * - If the file does not exist, generates a new name and stores it.
 */
export function getProcessName() {
    // Try to read the process name from the configuration file.
    try {
        return readFileSync(PROCESS_NAME_FILE, "utf8").trim();
    }
    catch {
        // Generate a new process name if reading fails
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        const newProcessName = Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
        // Write the new process name to the file for persistence
        try {
            writeFileSync(PROCESS_NAME_FILE, newProcessName, "utf8");
        }
        catch (err) {
            logger.error("Failed to write process name file:", err);
        }
        return newProcessName;
    }
}
