import type { TaskOptions } from "node-cron";
import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process";
import UnsCronProxy from "./uns-cron-proxy";
declare const unsCronPlugin: UnsProxyProcessPlugin;
export default unsCronPlugin;
export { UnsCronProxy };
export type UnsProxyProcessWithCron = UnsProxyProcess & {
    createCrontabProxy(cronExpression: string, options?: TaskOptions): Promise<UnsCronProxy>;
};
