import cron from "node-cron";
import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";
const normalizeTaskOptions = (options) => {
    if (!options) {
        return undefined;
    }
    const { event: _event, ...taskOptions } = options;
    return Object.keys(taskOptions).length > 0 ? taskOptions : undefined;
};
const normalizeCronSchedules = (input, options) => {
    const defaultEvent = options?.event;
    const defaultOptions = normalizeTaskOptions(options);
    const toSchedule = (cronExpression, event, scheduleOptions) => ({
        cronExpression,
        event,
        options: scheduleOptions,
    });
    if (typeof input === "string") {
        return [toSchedule(input, defaultEvent, defaultOptions)];
    }
    return input.map((entry) => {
        if (typeof entry === "string") {
            return toSchedule(entry, defaultEvent, defaultOptions);
        }
        return toSchedule(entry.cronExpression, entry.event ?? defaultEvent, entry.options ?? defaultOptions);
    });
};
export default class UnsCronProxy extends UnsProxy {
    tasks;
    constructor(cronInput, options) {
        super();
        const schedules = normalizeCronSchedules(cronInput, options);
        this.tasks = schedules.map((schedule) => cron.schedule(schedule.cronExpression, () => {
            this.event.emit("cronEvent", {
                event: schedule.event,
                cronExpression: schedule.cronExpression,
            });
        }, schedule.options));
    }
    async stop() {
        await super.stop();
        this.tasks.forEach((task) => task.stop());
    }
}
