import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import UnsCronProxy from "./uns-cron-proxy";
const cronProxyRegistry = new WeakMap();
const getCronProxies = (instance) => {
    let proxies = cronProxyRegistry.get(instance);
    if (!proxies) {
        proxies = [];
        cronProxyRegistry.set(instance, proxies);
    }
    return proxies;
};
const unsCronPlugin = ({ define }) => {
    define({
        async createCrontabProxy(cronExpression, options) {
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
