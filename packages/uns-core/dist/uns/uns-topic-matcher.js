export class UnsTopicMatcher {
    /**
     * Matches a topic with a topic filter, using MQTT rules.
     * @param topicFilter The MQTT topic filter (may contain `#` or `+` wildcards).
     * @param topic The topic to test against the filter.
     * @returns `true` if the topic matches the filter, `false` otherwise.
     */
    static matches(topicFilter, topic) {
        // Normalize leading/trailing slashes and collapse empties
        const filterSegments = topicFilter.split('/').filter(Boolean);
        const topicSegments = topic.split('/').filter(Boolean);
        for (let i = 0; i < filterSegments.length; i++) {
            const filterSegment = filterSegments[i];
            // Match `#` wildcard
            if (filterSegment === '#') {
                return true; // `#` matches everything that follows
            }
            // Match `+` wildcard
            if (filterSegment === '+') {
                if (topicSegments[i] === undefined) {
                    return false; // `+` should match exactly one level
                }
            }
            else {
                // Exact match required
                if (filterSegment !== topicSegments[i]) {
                    return false;
                }
            }
        }
        // Ensure there are no unmatched segments in the topic
        return filterSegments.length === topicSegments.length;
    }
}
