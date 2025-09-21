/**
 * AuthClient handles acquiring and refreshing JWT access tokens
 * using the configured REST base URL.
 */
export declare class AuthClient {
    private readonly restBase;
    private readonly namespace;
    private store;
    private constructor();
    static create(): Promise<AuthClient>;
    getAccessToken(): Promise<string>;
    private static isExpired;
    private static endpoint;
    private static fetchWithTimeout;
    private static extractRefreshCookie;
    private login;
    private refresh;
    private persistTokens;
    static promptCredentials(): Promise<{
        email: string;
        password: string;
    }>;
}
