import type { TaskOptions } from "node-cron";
import type UnsCronProxy from "./uns-cron-proxy.js";

declare module "@uns-kit/core/uns/uns-proxy-process" {
  interface UnsProxyProcess {
    createCrontabProxy(cronExpression: string, options?: TaskOptions): Promise<UnsCronProxy>;
  }
}
