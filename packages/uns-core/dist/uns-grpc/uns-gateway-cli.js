#!/usr/bin/env node
import { startUnsGateway } from "./uns-gateway-server.js";
function parseArgs() {
    const argv = process.argv.slice(2);
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const key = a.slice(2);
            const val = (i + 1 < argv.length && !argv[i + 1].startsWith("--")) ? argv[++i] : "true";
            args[key] = val;
        }
    }
    return args;
}
function parseAddrArg() {
    const idx = process.argv.indexOf("--addr");
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return process.argv[idx + 1];
    }
    return process.env.UNS_GATEWAY_ADDR;
}
const args = parseArgs();
const addr = parseAddrArg() ?? (typeof args["addr"] === "string" ? String(args["addr"]) : undefined);
const bound = await startUnsGateway(addr, {
    processNameOverride: typeof args["processName"] === "string" ? String(args["processName"]) : undefined,
    instanceSuffix: typeof args["instanceSuffix"] === "string" ? String(args["instanceSuffix"]) : undefined,
    instanceModeOverride: typeof args["instanceMode"] === "string" ? String(args["instanceMode"]) : undefined,
    handoverOverride: typeof args["handover"] === "string" ? (args["handover"] === "true") : undefined,
});
console.log(`UNS Gateway listening on ${bound.address} (UDS=${bound.isUDS})`);
setInterval(() => { }, 1 << 30);
