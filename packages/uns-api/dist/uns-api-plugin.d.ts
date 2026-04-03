import type { IApiProxyOptions } from "@uns-kit/core/uns/uns-interfaces.js";
import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process.js";
import UnsApiProxy from "./uns-api-proxy.js";
declare const unsApiPlugin: UnsProxyProcessPlugin;
export default unsApiPlugin;
export { UnsApiProxy };
export type UnsProxyProcessWithApi = UnsProxyProcess & {
    createApiProxy(instanceName: string, options: IApiProxyOptions): Promise<UnsApiProxy>;
};
