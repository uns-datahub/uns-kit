/**
 * MqttTopicBuilder is a utility class responsible for generating MQTT topics
 * based on a standardized pattern using the package name, version, and process name.
 *
 * This centralizes all MQTT topic definitions so that changes to topic structures
 * only need to be made in one place.
 */
export declare class MqttTopicBuilder {
    private processStatusTopic;
    /**
     * Constructor for MqttTopicBuilder.
     * It validates the provided process status topic and initializes the instance.
     * @param processStatusTopic The base topic for the process status.
     * Example: "uns-infra/packageName/version/processName/"
     */
    constructor(processStatusTopic: string);
    /**
     * Returns the process status topic.
     *
     * Example: "uns-infra/packageName/version/processName"
     */
    getProcessStatusTopic(): string;
    /**
     * Returns the topic used for publishing the active state.
     *
     * Example: "uns-infra/packageName/version/processName/active"
     */
    getActiveTopic(): string;
    /**
     * Returns the topic used for handover requests.
     *
     * Example: "uns-infra/packageName/version/processName/handover"
     */
    getHandoverTopic(): string;
    /**
     * Returns a wildcard topic for active status messages from any process.
     * Useful for subscriptions that must capture status from multiple processes.
     *
     * Example: "uns-infra/packageName/+/+/active"
     */
    getWildcardActiveTopic(): string;
    /**
     * Extract base topic from a full topic string.
     * This is useful for creating a topic builder from an existing topic.
     * @param fullTopic The full topic string.
     * Example: "uns-infra/packageName/version/processName/active"
     * @returns The base topic string.
     * Example: "uns-infra/packageName/version/processName/"
     */
    static extractBaseTopic(fullTopic: string): string;
}
//# sourceMappingURL=mqtt-topic-builder.d.ts.map