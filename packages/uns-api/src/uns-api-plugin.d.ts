import type { IApiProxyOptions } from "./api-interfaces.js";
import type UnsApiProxy from "./uns-api-proxy.js";

declare module "@uns-kit/core/uns/uns-proxy-process" {
  interface UnsProxyProcess {
    createApiProxy(instanceName: string, options: IApiProxyOptions): Promise<UnsApiProxy>;
  }
}
