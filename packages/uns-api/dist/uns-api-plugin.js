import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process.js";
import UnsApiProxy from "./uns-api-proxy.js";
const apiProxyRegistry = new WeakMap();
const getApiProxies = (instance) => {
    let proxies = apiProxyRegistry.get(instance);
    if (!proxies) {
        proxies = [];
        apiProxyRegistry.set(instance, proxies);
    }
    return proxies;
};
const unsApiPlugin = ({ define }) => {
    define({
        async createApiProxy(instanceName, options) {
            await this.waitForProcessConnection();
            const internals = this;
            const unsApiProxy = new UnsApiProxy(internals.processName, instanceName, options);
            unsApiProxy.event.on("unsProxyProducedTopics", (event) => {
                internals.processMqttProxy.publish(event.statusTopic, JSON.stringify(event.producedTopics), {
                    retain: true,
                    properties: { messageExpiryInterval: 120000 },
                });
            });
            unsApiProxy.event.on("unsProxyProducedApiEndpoints", (event) => {
                internals.processMqttProxy.publish(event.statusTopic, JSON.stringify(event.producedApiEndpoints), {
                    retain: true,
                    properties: { messageExpiryInterval: 120000 },
                });
            });
            internals.unsApiProxies.push(unsApiProxy);
            getApiProxies(this).push(unsApiProxy);
            return unsApiProxy;
        },
    });
};
UnsProxyProcess.use(unsApiPlugin);
export default unsApiPlugin;
export { UnsApiProxy };
