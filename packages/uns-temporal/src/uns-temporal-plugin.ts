import type { ClientOptions, ConnectionOptions } from "@temporalio/client";
import type MqttProxy from "@uns-kit/core/uns-mqtt/mqtt-proxy";
import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process";
import UnsTemporalProxy from "./uns-temporal-proxy.js";

type UnsProxyProcessInternal = {
  processName: string;
  processMqttProxy: MqttProxy;
  unsTemporalProxies: UnsTemporalProxy[];
};

const temporalProxyRegistry = new WeakMap<UnsProxyProcess, UnsTemporalProxy[]>();

const getTemporalProxies = (instance: UnsProxyProcess): UnsTemporalProxy[] => {
  let proxies = temporalProxyRegistry.get(instance);
  if (!proxies) {
    proxies = [];
    temporalProxyRegistry.set(instance, proxies);
  }
  return proxies;
};

const unsTemporalPlugin: UnsProxyProcessPlugin = ({ define }) => {
  define({
    async createTemporalProxy(
      this: UnsProxyProcess,
      instanceName: string,
      temporalAddress: string,
      temporalNamespace: string,
      connectionOverrides?: ConnectionOptions,
      clientOverrides?: ClientOptions,
    ) {
      await this.waitForProcessConnection();

      const internals = this as unknown as UnsProxyProcessInternal;

      const connectionOptions: ConnectionOptions = {
        address: temporalAddress,
        ...connectionOverrides,
      };

      const clientOptions: ClientOptions = {
        namespace: temporalNamespace,
        ...clientOverrides,
      };

      const unsTemporalProxy = new UnsTemporalProxy(
        internals.processName,
        instanceName,
        connectionOptions,
        clientOptions,
      );

      unsTemporalProxy.event.on("unsProxyProducedTopics", (event) => {
        internals.processMqttProxy.publish(
          event.statusTopic,
          JSON.stringify(event.producedTopics),
          {
            retain: true,
            properties: { messageExpiryInterval: 120000 },
          },
        );
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

export type UnsProxyProcessWithTemporal = UnsProxyProcess & {
  createTemporalProxy(
    instanceName: string,
    temporalAddress: string,
    temporalNamespace: string,
    connectionOverrides?: ConnectionOptions,
    clientOverrides?: ClientOptions,
  ): Promise<UnsTemporalProxy>;
};
