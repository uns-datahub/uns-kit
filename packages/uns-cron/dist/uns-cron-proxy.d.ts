import { TaskOptions } from "node-cron";
import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";
export type CronSchedule = {
    cronExpression: string;
    event?: string;
    options?: TaskOptions;
};
export type CronScheduleInput = string | string[] | CronSchedule[];
export type CronProxyOptions = TaskOptions & {
    event?: string;
};
export default class UnsCronProxy extends UnsProxy {
    private readonly tasks;
    constructor(cronInput: CronScheduleInput, options?: CronProxyOptions);
    stop(): Promise<void>;
}
