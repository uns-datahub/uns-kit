/**
 * Abstraction over secure storage for tokens.
 *
 * Prefers OS keychain via `keytar` if available at runtime.
 * Falls back to a local file store with restricted permissions.
 */
export interface ISecureStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
}
export declare class SecureStoreFactory {
    /**
     * Creates a secure store for a namespace. Tries keytar first; falls back to file store.
     */
    static create(namespace: string): Promise<ISecureStore>;
}
