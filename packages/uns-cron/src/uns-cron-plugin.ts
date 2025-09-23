import type { TaskOptions } from "node-cron";
import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process";
import UnsCronProxy from "./uns-cron-proxy";

const cronProxyRegistry = new WeakMap<UnsProxyProcess, UnsCronProxy[]>();

const getCronProxies = (instance: UnsProxyProcess): UnsCronProxy[] => {
  let proxies = cronProxyRegistry.get(instance);
  if (!proxies) {
    proxies = [];
    cronProxyRegistry.set(instance, proxies);
  }
  return proxies;
};

const unsCronPlugin: UnsProxyProcessPlugin = ({ define }) => {
  define({
    async createCrontabProxy(this: UnsProxyProcess, cronExpression: string, options?: TaskOptions) {
      await this.waitForProcessConnection();
      const unsCronProxy = new UnsCronProxy(cronExpression, options);
      getCronProxies(this).push(unsCronProxy);
      return unsCronProxy;
    },
  });
};

UnsProxyProcess.use(unsCronPlugin);

export default unsCronPlugin;

export { UnsCronProxy };

export type UnsProxyProcessWithCron = UnsProxyProcess & {
  createCrontabProxy(cronExpression: string, options?: TaskOptions): Promise<UnsCronProxy>;
};
