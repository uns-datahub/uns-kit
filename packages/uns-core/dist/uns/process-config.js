// process-config.ts
import * as path from "path";
import { readFileSync } from "fs";
import { basePath } from "../base-path";
// Path to the process name file
export const PROCESS_NAME_FILE = path.join(basePath, "uns-process-name.conf");
// Path to package.json to retrieve package name and version
export const PACKAGE_JSON_PATH = path.join(basePath, "package.json");
export const PACKAGE_INFO = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
// Other configuration values (update intervals, timeouts, etc.)
export const MQTT_UPDATE_INTERVAL = 10000; // in milliseconds
export const ACTIVE_TIMEOUT = 10000; // in milliseconds
