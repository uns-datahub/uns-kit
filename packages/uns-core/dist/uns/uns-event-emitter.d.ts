export declare class UnsEventEmitter<Events extends Record<string, any>> {
    private listeners;
    on<K extends keyof Events>(eventName: K, listener: (event: Events[K]) => void): void;
    off<K extends keyof Events>(eventName: K, listener: (event: Events[K]) => void): void;
    emit<K extends keyof Events>(eventName: K, event: Events[K]): void;
}
//# sourceMappingURL=uns-event-emitter.d.ts.map