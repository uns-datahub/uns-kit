import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process.js";
import UnsCronProxy, { type CronProxyOptions, type CronScheduleInput } from "./uns-cron-proxy.js";
declare const unsCronPlugin: UnsProxyProcessPlugin;
export default unsCronPlugin;
export { UnsCronProxy };
export type UnsProxyProcessWithCron = UnsProxyProcess & {
    createCrontabProxy(cronInput: CronScheduleInput, options?: CronProxyOptions): Promise<UnsCronProxy>;
};
