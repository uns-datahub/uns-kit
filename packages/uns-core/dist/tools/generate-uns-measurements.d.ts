#!/usr/bin/env node
type Entry = {
    value: string;
    description?: string | null;
    descriptions?: Record<string, string | null | undefined>;
    [key: string]: unknown;
};
type MeasurementsJson = {
    schemaVersion?: unknown;
    physical?: Record<string, Entry>;
    dataSize?: Record<string, Entry>;
    counter?: Record<string, Entry>;
    [category: string]: unknown;
};
export declare function renderMeasurementsTs(json: MeasurementsJson, lang: string): string;
export declare function generateUnsMeasurements(args: Partial<{
    input: string;
    output: string;
    lang: string;
}>): Promise<void>;
export {};
//# sourceMappingURL=generate-uns-measurements.d.ts.map