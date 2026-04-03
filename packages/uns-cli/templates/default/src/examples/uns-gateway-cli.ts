import { startUnsGateway } from "@uns-kit/core/uns-grpc/uns-gateway-server.js";
import { getLogger } from "@uns-kit/core";

const logger = getLogger(import.meta.url);

const addr = await startUnsGateway();
logger.info(`UNS Gateway listening on ${addr.address} (UDS=${addr.isUDS})`);
// Keep alive
setInterval(() => {}, 1 << 30);

