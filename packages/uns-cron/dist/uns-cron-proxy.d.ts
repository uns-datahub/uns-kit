import { TaskOptions } from "node-cron";
import UnsProxy from "@uns-kit/core/uns/uns-proxy";
export default class UnsCronProxy extends UnsProxy {
    private readonly cronExpression;
    private readonly task;
    constructor(cronExpression: string, options?: TaskOptions);
    stop(): Promise<void>;
}
