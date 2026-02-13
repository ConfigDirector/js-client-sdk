import { describe, expect, it } from "vitest";
import { EventQueue } from "../../src/telemetry/EventQueue";

type TestEvent = {
  k: number;
};

describe("EventQueue", () => {
  it("drops older events when the limit is reached", () => {
    const queue = new EventQueue<TestEvent>(4);
    expect(queue.reachedLimit).toBe(false);
    expect(queue.droppedEventCount).toBe(0);

    queue.push({ k: 1 });
    queue.push({ k: 2 });
    queue.push({ k: 3 });
    queue.push({ k: 4 });
    expect(queue.events.map((e) => e.k)).toEqual([1, 2, 3, 4]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(0);

    queue.push({ k: 5 });
    expect(queue.events.map((e) => e.k)).toEqual([2, 3, 4, 5]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(1);

    queue.push({ k: 6 }, { k: 7 });
    expect(queue.events.map((e) => e.k)).toEqual([4, 5, 6, 7]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(3);
  });

  it("drops given events as well when they are over the limit", () => {
    const queue = new EventQueue<TestEvent>(4);

    queue.push({ k: 1 });
    queue.push({ k: 2 });
    queue.push({ k: 3 });
    expect(queue.events.map((e) => e.k)).toEqual([1, 2, 3]);
    expect(queue.reachedLimit).toBe(false);
    expect(queue.droppedEventCount).toBe(0);

    queue.push({ k: 4 }, { k: 5 }, { k: 6 }, { k: 7 }, { k: 8 });
    expect(queue.events.map((e) => e.k)).toEqual([5, 6, 7, 8]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(4);

    queue.push({ k: 9 }, { k: 10 }, { k: 11 }, { k: 12 }, { k: 13 });
    expect(queue.events.map((e) => e.k)).toEqual([10, 11, 12, 13]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(9);
  });

  it("handles too many events on an empty queue", () => {
    const queue = new EventQueue<TestEvent>(4);

    queue.push({ k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }, { k: 5 });
    expect(queue.events.map((e) => e.k)).toEqual([2, 3, 4, 5]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(1);
  });
});
