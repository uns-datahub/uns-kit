import { describe, expect, it } from "vitest";

import { ThrottledPublisher } from "../packages/uns-core/src/uns-mqtt/throttled-queue.js";

describe("ThrottledPublisher", () => {
  it("publishes with bounded concurrency", async () => {
    let current = 0;
    let maxObserved = 0;

    const publisher = new ThrottledPublisher(
      0,
      async () => {
        current += 1;
        maxObserved = Math.max(maxObserved, current);
        await new Promise((resolve) => setTimeout(resolve, 40));
        current -= 1;
      },
      false,
      undefined,
      "test-publisher",
      true,
      3,
    );

    await Promise.all([
      publisher.enqueue("a", "1", "1"),
      publisher.enqueue("a", "2", "2"),
      publisher.enqueue("a", "3", "3"),
      publisher.enqueue("a", "4", "4"),
      publisher.enqueue("a", "5", "5"),
    ]);

    expect(maxObserved).toBeGreaterThan(1);
    expect(maxObserved).toBeLessThanOrEqual(3);
  });

  it("rejects enqueue when max pending publishes is exceeded", async () => {
    const publisher = new ThrottledPublisher(
      0,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
      false,
      undefined,
      "test-publisher",
      true,
      1,
      2,
    );

    const first = publisher.enqueue("a", "1", "1");
    const second = publisher.enqueue("a", "2", "2");
    expect(() => publisher.enqueue("a", "3", "3")).toThrow("Publisher queue is full");
    await Promise.all([first, second]);
  });
});
