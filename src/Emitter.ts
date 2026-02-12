type EventType = string | symbol;
type EventsRecord = Record<EventType, any>;

type Handler<TEventsRecord extends EventsRecord, TKey extends keyof TEventsRecord> = (
  payload: TEventsRecord[TKey],
) => void;

export interface EventProvider<TEventsRecord extends EventsRecord> {
  on<TName extends keyof TEventsRecord>(name: TName, handler: Handler<TEventsRecord, TName>): void;
  off<TName extends keyof TEventsRecord>(name: TName, handler?: Handler<TEventsRecord, TName>): void;
  clear(): void;
}

export class Emitter<TEventsRecord extends EventsRecord> implements EventProvider<TEventsRecord> {
  private handlerMap: Map<keyof TEventsRecord, Array<(payload: any) => void>> = new Map();

  on<TName extends keyof TEventsRecord>(name: TName, handler: Handler<TEventsRecord, TName>) {
    const handlers = this.handlerMap.get(name);
    if (handlers) {
      handlers.push(handler);
    } else {
      this.handlerMap.set(name, [handler]);
    }
  }

  once<TName extends keyof TEventsRecord>(name: TName, handler: Handler<TEventsRecord, TName>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    function onceHandler(payload: TEventsRecord[keyof TEventsRecord]) {
      self.off(name, onceHandler);
      handler.apply(self, payload);
    }
    this.on(name, onceHandler);
  }

  off<TName extends keyof TEventsRecord>(name: TName, handler?: Handler<TEventsRecord, TName>) {
    const handlers = this.handlerMap.get(name);
    if (!handlers) {
      return;
    }

    if (handler) {
      const listenerIndex = handlers.indexOf(handler);
      if (listenerIndex >= 0) {
        handlers.splice(listenerIndex, 1);
      }
    } else {
      this.handlerMap.set(name, []);
    }
  }

  clear() {
    this.handlerMap.clear();
  }

  emit<TName extends keyof TEventsRecord>(name: TName, payload: TEventsRecord[TName]) {
    const handlers = this.handlerMap.get(name);
    if (!handlers) {
      return;
    }

    handlers.slice().map((h) => h(payload));
  }
}
