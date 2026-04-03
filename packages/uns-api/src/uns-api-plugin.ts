import type { IApiProxyOptions } from "@uns-kit/core/uns/uns-interfaces.js";
import type MqttProxy from "@uns-kit/core/uns-mqtt/mqtt-proxy.js";
import UnsProxyProcess, { type UnsProxyProcessPlugin } from "@uns-kit/core/uns/uns-proxy-process.js";
import UnsApiProxy from "./uns-api-proxy.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import type { IUnsMessage } from "@uns-kit/core/uns/uns-interfaces.js";

const apiProxyRegistry = new WeakMap<UnsProxyProcess, UnsApiProxy[]>();

const getApiProxies = (instance: UnsProxyProcess): UnsApiProxy[] => {
  let proxies = apiProxyRegistry.get(instance);
  if (!proxies) {
    proxies = [];
    apiProxyRegistry.set(instance, proxies);
  }
  return proxies;
};

const unsApiPlugin: UnsProxyProcessPlugin = ({ define }) => {
  define({
    async createApiProxy(this: UnsProxyProcess, instanceName: string, options: IApiProxyOptions) {
      await this.waitForProcessConnection();

      const internals = this as unknown as {
        processName: string;
        processMqttProxy: MqttProxy;
        unsApiProxies: UnsApiProxy[];
      };

      const unsApiProxy = new UnsApiProxy(internals.processName, instanceName, options);

      unsApiProxy.event.on("unsProxyProducedTopics", (event) => {
        internals.processMqttProxy.publish(
          event.statusTopic,
          JSON.stringify(event.producedTopics),
          {
            retain: true,
            properties: { messageExpiryInterval: 120000 },
          },
        );
      });

      unsApiProxy.event.on("unsProxyProducedApiEndpoints", (event) => {
        internals.processMqttProxy.publish(
          event.statusTopic,
          JSON.stringify(event.producedApiEndpoints),
          {
            retain: true,
            properties: { messageExpiryInterval: 120000 },
          },
        );
      });

      unsApiProxy.event.on("unsProxyProducedApiCatchAll", (event) => {
        internals.processMqttProxy.publish(
          event.statusTopic,
          JSON.stringify(event.producedCatchall),
          {
            retain: true,
            properties: { messageExpiryInterval: 120000 },
          },
        );
      });

      unsApiProxy.event.on("mqttProxyStatus", (event) => {
        const time = UnsPacket.formatToISO8601(new Date());
        const unsMessage: IUnsMessage = { data: { time, value: event.value, uom: event.uom } };
        UnsPacket.unsPacketFromUnsMessage(unsMessage).then((packet) => {
          internals.processMqttProxy.publish(
            event.statusTopic,
            JSON.stringify(packet),
          );
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

export type UnsProxyProcessWithApi = UnsProxyProcess & {
  createApiProxy(instanceName: string, options: IApiProxyOptions): Promise<UnsApiProxy>;
};
