export declare class UnsTopicMatcher {
    /**
     * Matches a topic with a topic filter, using MQTT rules.
     * @param topicFilter The MQTT topic filter (may contain `#` or `+` wildcards).
     * @param topic The topic to test against the filter.
     * @returns `true` if the topic matches the filter, `false` otherwise.
     */
    static matches(topicFilter: string, topic: string): boolean;
}
//# sourceMappingURL=uns-topic-matcher.d.ts.map