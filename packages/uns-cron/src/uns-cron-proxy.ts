import cron, { ScheduledTask, TaskOptions } from "node-cron";
import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";

export default class UnsCronProxy extends UnsProxy {
  private readonly task: ScheduledTask;

  constructor(private readonly cronExpression: string, options?: TaskOptions) {
    super();
    this.task = cron.schedule(this.cronExpression, () => {
      this.event.emit("cronEvent", {});
    }, options);
  }

  public override async stop(): Promise<void> {
    await super.stop();
    this.task.stop();
  }
}
