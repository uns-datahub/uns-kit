/**
 * MqttTopicBuilder is a utility class responsible for generating MQTT topics
 * based on a standardized pattern using the package name, version, and process name.
 *
 * This centralizes all MQTT topic definitions so that changes to topic structures
 * only need to be made in one place.
 */
export class MqttTopicBuilder {
    private processStatusTopic: string;

    /**
     * Constructor for MqttTopicBuilder.
     * It validates the provided process status topic and initializes the instance.
     * @param processStatusTopic The base topic for the process status.
     * Example: "uns-infra/packageName/version/processName/"
     */
    constructor(processStatusTopic: string) {
      if (!/^uns-infra\/[^/]+\/[^/]+\/[^/]+\/$/.test(processStatusTopic)) {
        throw new Error("processStatusTopic must follow the pattern 'uns-infra/<packageName>/<version>/<processName>/'");
      }
      this.processStatusTopic = processStatusTopic;
    }
  
    /**
     * Returns the process status topic.
     *
     * Example: "uns-infra/packageName/version/processName"
     */
    public getProcessStatusTopic(): string {
      return this.processStatusTopic;
    }
  
    /**
     * Returns the topic used for publishing the active state.
     *
     * Example: "uns-infra/packageName/version/processName/active"
     */
    public getActiveTopic(): string {
      return this.getProcessStatusTopic() + "active";
    }
  
    /**
     * Returns the topic used for handover requests.
     *
     * Example: "uns-infra/packageName/version/processName/handover"
     */
    public getHandoverTopic(): string {
      return this.getProcessStatusTopic() + "handover";
    }
    
    /**
     * Returns a wildcard topic for active status messages from any process.
     * Useful for subscriptions that must capture status from multiple processes.
     *
     * Example: "uns-infra/packageName/+/+/active"
     */
    public getWildcardActiveTopic(): string {
      return this.getProcessStatusTopic().split('/').slice(0, 2).join('/') + '/+/+/active';
    }

    /**
     * Extract base topic from a full topic string.
     * This is useful for creating a topic builder from an existing topic.
     * @param fullTopic The full topic string.
     * Example: "uns-infra/packageName/version/processName/active"
     * @returns The base topic string.
     * Example: "uns-infra/packageName/version/processName/"
     */
    public static extractBaseTopic(fullTopic: string): string {
      const parts = fullTopic.split('/');
      if (parts.length < 4) {
        throw new Error("Invalid topic format. Expected 'uns-infra/<packageName>/<version>/<processName>/'.");
      }
      return parts.slice(0, 4).join('/') + '/';
    }
  }
  