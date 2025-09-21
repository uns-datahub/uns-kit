/**
 * Retrieves a persistent process name.
 * - Checks if a process name is provided via command-line args.
 * - Otherwise, reads the process name from a file.
 * - If the file does not exist, generates a new name and stores it.
 */
export declare function getProcessName(): string;
