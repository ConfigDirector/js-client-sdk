import { AggregatedEvent, EventQueueSnapshot, ReportableEvent } from "./types";

export class EventAggregator {
  public aggregate<T extends ReportableEvent>(snapshot: EventQueueSnapshot<T>): AggregatedEvent<T>[] {
    if (snapshot.events.length == 0) {
      return [];
    }

    const map = new Map<string, { event: T; count: number }>();
    for (const event of snapshot.events) {
      const serializedEvent = JSON.stringify(event);
      const count = map.get(serializedEvent)?.count || 0;
      map.set(serializedEvent, { event, count: count + 1 });
    }
    return Array.from(map).map(([, v]) => {
      return {
        startTime: snapshot.startTime,
        endTime: snapshot.endTime,
        count: v.count,
        event: v.event,
      };
    });
  }
}
