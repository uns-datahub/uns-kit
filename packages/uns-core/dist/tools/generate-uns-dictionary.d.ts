#!/usr/bin/env node
type DictionaryEntry = {
    description?: string | null;
    descriptions?: Record<string, string | null | undefined>;
    [key: string]: unknown;
};
type ObjectTypeEntry = DictionaryEntry & {
    attributes?: string[] | null;
};
type UnsDictionary = {
    schemaVersion?: unknown;
    objectTypes?: Record<string, ObjectTypeEntry>;
    attributes?: Record<string, DictionaryEntry>;
    [key: string]: unknown;
};
type CliArgs = {
    input: string;
    output: string;
    lang: string;
};
export declare function generateUnsDictionary(args: Partial<CliArgs>): Promise<void>;
export declare function renderDictionaryTs(dictionary: UnsDictionary, lang: string): string;
export {};
//# sourceMappingURL=generate-uns-dictionary.d.ts.map