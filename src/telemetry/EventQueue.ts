import { EventQueueSnapshot, ReportableEvent } from "./types";

export class EventQueue<T extends ReportableEvent> {
  private readonly limit: number;
  private startTime?: Date;
  private _events: T[] = [];
  private _droppedEventCount = 0;

  constructor(limit?: number) {
    this.limit = limit ?? 1_000;
  }

  public get events(): T[] {
    return this._events;
  }

  public get reachedLimit(): boolean {
    return this._events.length >= this.limit;
  }

  public get droppedEventCount(): number {
    return this._droppedEventCount;
  }

  public push(...newEvents: T[]) {
    if (!this.startTime) {
      this.startTime = new Date();
    }

    const newEventsCountToDrop = Math.max(0, newEvents.length - this.limit);
    const eventsToPush = newEvents.slice(newEventsCountToDrop, newEvents.length);
    this._droppedEventCount += newEventsCountToDrop;
    if (this._events.length + eventsToPush.length > this.limit) {
      const eventCountToDrop = this._events.length + eventsToPush.length - this.limit;
      this._events.splice(0, eventCountToDrop);
      this._droppedEventCount += eventCountToDrop;
    }
    return this._events.push(...eventsToPush);
  }

  public takeSnapshot(): EventQueueSnapshot<T> {
    const endTime = new Date();
    const startTime = this.startTime ?? endTime;
    const eventsSnapshot = this._events.splice(0);
    const droppedCount = this._droppedEventCount;
    this.startTime = undefined;
    this._droppedEventCount = 0;
    return {
      startTime,
      endTime,
      events: eventsSnapshot,
      droppedCount,
    };
  }

  public clear() {
    this._events = [];
    this.startTime = undefined;
    this._droppedEventCount = 0;
  }
}
