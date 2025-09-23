export class HandoverManagerEventEmitter {
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
//# sourceMappingURL=handover-manager-event-emitter.js.map