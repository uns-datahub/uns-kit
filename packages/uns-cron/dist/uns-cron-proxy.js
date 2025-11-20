import cron from "node-cron";
import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";
export default class UnsCronProxy extends UnsProxy {
    cronExpression;
    task;
    constructor(cronExpression, options) {
        super();
        this.cronExpression = cronExpression;
        this.task = cron.schedule(this.cronExpression, () => {
            this.event.emit("cronEvent", {});
        }, options);
    }
    async stop() {
        await super.stop();
        this.task.stop();
    }
}
