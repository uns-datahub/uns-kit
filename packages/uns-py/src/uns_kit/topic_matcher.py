from __future__ import annotations


def matches_topic_filter(topic_filter: str, topic: str) -> bool:
    filter_segments = [segment for segment in topic_filter.split("/") if segment]
    topic_segments = [segment for segment in topic.split("/") if segment]

    for index, filter_segment in enumerate(filter_segments):
        if filter_segment == "#":
            return True
        if filter_segment == "+":
            if index >= len(topic_segments):
                return False
            continue
        if index >= len(topic_segments) or filter_segment != topic_segments[index]:
            return False

    return len(filter_segments) == len(topic_segments)
