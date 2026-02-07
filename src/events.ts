type EventType = string | symbol;
type Events = Record<EventType, any>;

type Handler<T = Events[keyof Events]> = (event: T) => void;
type EventHandlerList<T = unknown> = Array<Handler<T>>;
type EventHandlerMap<Events extends Record<EventType, unknown>> = Map<
  keyof Events,
  EventHandlerList<Events[keyof Events]>
>;

export interface EventProvider<TEvents extends Events> {
  on(eventName: keyof TEvents, handler: (payload: TEvents[keyof TEvents]) => void): void;
  off(eventName: keyof TEvents, handler?: (payload: TEvents[keyof TEvents]) => void): void;
  clear(): void;
};

export class Emitter<TEvents extends Events> implements EventProvider<TEvents> {
  private handlerMap: EventHandlerMap<TEvents> = new Map();

  on(eventName: keyof TEvents, handler: (payload: TEvents[keyof TEvents]) => void) {
    const handlers = this.handlerMap.get(eventName);
    if (handlers) {
      handlers.push(handler);
    } else {
      this.handlerMap.set(eventName, [handler]);
    }
  }

  once(eventName: keyof TEvents, handler: (payload: TEvents[keyof TEvents]) => void) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    function onceHandler(payload: TEvents[keyof TEvents]) {
      self.off(eventName, onceHandler);
      handler.apply(self, payload);
    };
    this.on(eventName, onceHandler);
  };

  off(eventName: keyof TEvents, handler?: (payload: TEvents[keyof TEvents]) => void) {
    const handlers = this.handlerMap.get(eventName);
    if (!handlers) {
      return;
    }

    if (handler) {
      const listenerIndex = handlers.indexOf(handler);
      if (listenerIndex >= 0) {
        handlers.splice(listenerIndex, 1);
      }
    } else {
      this.handlerMap.set(eventName, []);
    }
  }

  clear() {
    this.handlerMap.clear();
  }

  emit(eventName: keyof TEvents, payload: TEvents[keyof TEvents]) {
    const handlers = this.handlerMap.get(eventName);
    if (!handlers) {
      return;
    }

    handlers.slice().map((h) => h(payload));
  }
}
