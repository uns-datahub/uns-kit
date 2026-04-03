export class UnsEventEmitter<Events extends Record<string, any>> {
  private listeners: {
    [K in keyof Events]?: Array<(event: Events[K]) => void>;
  } = {};

  on<K extends keyof Events>(
    eventName: K,
    listener: (event: Events[K]) => void,
  ): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push(listener);
  }

  off<K extends keyof Events>(
    eventName: K,
    listener: (event: Events[K]) => void,
  ): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName]!.filter(
      (l) => l !== listener,
    );
  }

  emit<K extends keyof Events>(eventName: K, event: Events[K]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName]!.forEach((listener) => listener(event));
  }
}