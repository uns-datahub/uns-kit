import type { ClientOptions, ConnectionOptions } from "@temporalio/client";
import type UnsTemporalProxy from "./uns-temporal-proxy.js";

declare module "@uns-kit/core/uns/uns-proxy-process" {
  interface UnsProxyProcess {
    createTemporalProxy(
      instanceName: string,
      temporalAddress: string,
      temporalNamespace: string,
      connectionOverrides?: ConnectionOptions,
      clientOverrides?: ClientOptions,
    ): Promise<UnsTemporalProxy>;
  }
}
