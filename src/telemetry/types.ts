export type ReportableEvent = Record<string | symbol, any>;

export type EventQueueSnapshot<T extends ReportableEvent> = {
  startTime: Date;
  endTime: Date;
  events: T[];
  droppedCount: number;
};

export type AggregatedEvent<T extends ReportableEvent> = {
  startTime: Date;
  endTime: Date;
  count: number;
  event: T;
};

export type DiscreteEventList = Record<string | symbol, ReportableEvent[]>;
export type AggregatedEventList = Record<string | symbol, AggregatedEvent<ReportableEvent>[]>;
export type DroppedEvents = Record<string, number>;

export type EventReport = {
  clientSdkKey: string;
  discreteEvents: DiscreteEventList;
  aggregatedEvents: AggregatedEventList;
  droppedEvents?: DroppedEvents;
};

export type ReporterResponse = {
  success: boolean;
  fatalError: boolean;
};
