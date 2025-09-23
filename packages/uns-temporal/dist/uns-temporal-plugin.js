import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import UnsTemporalProxy from "./uns-temporal-proxy.js";
const temporalProxyRegistry = new WeakMap();
const getTemporalProxies = (instance) => {
    let proxies = temporalProxyRegistry.get(instance);
    if (!proxies) {
        proxies = [];
        temporalProxyRegistry.set(instance, proxies);
    }
    return proxies;
};
const unsTemporalPlugin = ({ define }) => {
    define({
        async createTemporalProxy(instanceName, temporalAddress, temporalNamespace, connectionOverrides, clientOverrides) {
            await this.waitForProcessConnection();
            const internals = this;
            const connectionOptions = {
                address: temporalAddress,
                ...connectionOverrides,
            };
            const clientOptions = {
                namespace: temporalNamespace,
                ...clientOverrides,
            };
            const unsTemporalProxy = new UnsTemporalProxy(internals.processName, instanceName, connectionOptions, clientOptions);
            unsTemporalProxy.event.on("unsProxyProducedTopics", (event) => {
                internals.processMqttProxy.publish(event.statusTopic, JSON.stringify(event.producedTopics), {
                    retain: true,
                    properties: { messageExpiryInterval: 120000 },
                });
            });
            internals.unsTemporalProxies.push(unsTemporalProxy);
            getTemporalProxies(this).push(unsTemporalProxy);
            return unsTemporalProxy;
        },
    });
};
UnsProxyProcess.use(unsTemporalPlugin);
export default unsTemporalPlugin;
export { UnsTemporalProxy };
