// process-config.ts
import * as path from "path";
import { readFileSync } from "fs";
import { basePath } from "../base-path.js";
// Path to package.json to retrieve package name and version
export const PACKAGE_JSON_PATH = path.join(basePath, "package.json");
const rawPackageInfo = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
export const PACKAGE_INFO = {
    ...rawPackageInfo,
    name: rawPackageInfo.name
};
// Other configuration values (update intervals, timeouts, etc.)
export const MQTT_UPDATE_INTERVAL = 10000; // in milliseconds
export const ACTIVE_TIMEOUT = 10000; // in milliseconds
//# sourceMappingURL=process-config.js.map