import {
  GeneratedCounterMeasurement,
  GeneratedCounterMeasurements,
  GeneratedDataSizeMeasurement,
  GeneratedDataSizeMeasurements,
  GeneratedMeasurementUnit,
  GeneratedPhysicalMeasurement,
  GeneratedPhysicalMeasurements,
} from "./uns-measurements.generated.js";

export const PhysicalMeasurements = GeneratedPhysicalMeasurements;
export type PhysicalMeasurements = GeneratedPhysicalMeasurement;

export const DataSizeMeasurements = GeneratedDataSizeMeasurements;
export type DataSizeMeasurements = GeneratedDataSizeMeasurement;

export const CounterMeasurements = GeneratedCounterMeasurements;
export type CounterMeasurements = GeneratedCounterMeasurement;

export type MeasurementUnit = GeneratedMeasurementUnit;
