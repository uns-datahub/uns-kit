export class UnsEventEmitter {
    listeners = {};
    on(eventName, listener) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(listener);
    }
    off(eventName, listener) {
        if (!this.listeners[eventName])
            return;
        this.listeners[eventName] = this.listeners[eventName].filter((l) => l !== listener);
    }
    emit(eventName, event) {
        if (!this.listeners[eventName])
            return;
        this.listeners[eventName].forEach((listener) => listener(event));
    }
}
//# sourceMappingURL=uns-event-emitter.js.map