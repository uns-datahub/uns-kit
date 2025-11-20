import type { ClientOptions, ConnectionOptions } from "@temporalio/client";
import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process.js";
import UnsTemporalProxy from "./uns-temporal-proxy.js";
declare const unsTemporalPlugin: UnsProxyProcessPlugin;
export default unsTemporalPlugin;
export { UnsTemporalProxy };
export type UnsProxyProcessWithTemporal = UnsProxyProcess & {
    createTemporalProxy(instanceName: string, temporalAddress: string, temporalNamespace: string, connectionOverrides?: ConnectionOptions, clientOverrides?: ClientOptions): Promise<UnsTemporalProxy>;
};
