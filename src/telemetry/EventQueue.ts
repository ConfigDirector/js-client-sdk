import { EventQueueSnapshot, ReportableEvent } from "./types";

export class EventQueue<T extends ReportableEvent> {
  private startTime?: Date;
  private events: T[] = [];

  public push(...events: T[]) {
    if (!this.startTime) {
      this.startTime = new Date();
    }
    return this.events.push(...events);
  }

  public takeSnapshot(): EventQueueSnapshot<T> {
    const endTime = new Date();
    const startTime = this.startTime ?? endTime;
    const eventsSnapshot = this.events.splice(0);
    this.startTime = undefined;
    return {
      startTime,
      endTime,
      events: eventsSnapshot,
    };
  }

  public clear() {
    this.events = [];
    this.startTime = undefined;
  }
}
