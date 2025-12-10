// Flat list of common UNS attributes (add your own as needed).
export const knownUnsAttributes = [
  "measured-temperature",
  "measured-vibration",
  "measured-pressure",
  "measured-flow",
  "temperature",
  "status",
  "operating-hours",
  "fault-code",
  "speed",
  "energy-consumption",
  "power",
  "voltage",
  "current",
  "energy",
  "lot",
  "lot-id",
  "batch-number",
  "material-type",
  "quantity",
  "location",
  "presence",
  "task-id",
  "assigned-task",
  "role",
  "start-time",
  "end-time",
  "duration",
  "output-quantity",
  "product-code",
  "revision",
  "specification",
  "target-parameters",
  "material-composition",
  "version-history",
  "inspection-result",
  "deviation",
  "pass-fail",
  "surface-defect",
  "hardness",
  "tensile-strength",
  "work-order-id",
  "task-list",
  "planned-start",
  "planned-end",
  "assigned-to",
  "instruction-url",
  "pressure",
  "flow",
  "consumption",
  "alarm",
  "availability",
  "utilization",
  "downtime",
  "maintenance-status",
  "frequency",
  "cost",
  "total-flow",
  "conductivity",
  "ph",
  "level",
  "consumption-rate",
  "refill-required",
  "last-refill",
] as const;

export type KnownUnsAttributeName = typeof knownUnsAttributes[number];

// Allow known attribute names while still allowing arbitrary strings.
export type UnsAttribute = KnownUnsAttributeName | (string & {});

// Convenience attribute groups per object type (optional to use).
export const EquipmentAttributes = {
  Status: "status",
  MeasuredTemperature: "measured-temperature",
  MeasuredVibration: "measured-vibration",
  MeasuredPressure: "measured-pressure",
  MeasuredFlow: "measured-flow",
  OperatingHours: "operating-hours",
  FaultCode: "fault-code",
  Speed: "speed",
  EnergyConsumption: "energy-consumption",
  Power: "power",
  Voltage: "voltage",
  Current: "current",
  Energy: "energy",
} as const;
export type EquipmentAttributeName = typeof EquipmentAttributes[keyof typeof EquipmentAttributes];

export const MaterialAttributes = {
  Lot: "lot",
  LotId: "lot-id",
  BatchNumber: "batch-number",
  MaterialType: "material-type",
  Quantity: "quantity",
  Location: "location",
  Status: "status",
} as const;
export type MaterialAttributeName = typeof MaterialAttributes[keyof typeof MaterialAttributes];

export const PersonnelAttributes = {
  Presence: "presence",
  TaskId: "task-id",
  AssignedTask: "assigned-task",
  Role: "role",
  Status: "status",
} as const;
export type PersonnelAttributeName = typeof PersonnelAttributes[keyof typeof PersonnelAttributes];

export const ProcessSegmentAttributes = {
  StartTime: "start-time",
  EndTime: "end-time",
  Duration: "duration",
  Status: "status",
  OutputQuantity: "output-quantity",
} as const;
export type ProcessSegmentAttributeName = typeof ProcessSegmentAttributes[keyof typeof ProcessSegmentAttributes];

export const ProductDefinitionAttributes = {
  ProductCode: "product-code",
  Revision: "revision",
  Specification: "specification",
  TargetParameters: "target-parameters",
  MaterialComposition: "material-composition",
  VersionHistory: "version-history",
} as const;
export type ProductDefinitionAttributeName = typeof ProductDefinitionAttributes[keyof typeof ProductDefinitionAttributes];

export const ProductQualityAttributes = {
  InspectionResult: "inspection-result",
  Deviation: "deviation",
  PassFail: "pass-fail",
  SurfaceDefect: "surface-defect",
  Hardness: "hardness",
  TensileStrength: "tensile-strength",
} as const;
export type ProductQualityAttributeName = typeof ProductQualityAttributes[keyof typeof ProductQualityAttributes];

export const WorkDefinitionAttributes = {
  WorkOrderId: "work-order-id",
  TaskList: "task-list",
  PlannedStart: "planned-start",
  PlannedEnd: "planned-end",
  AssignedTo: "assigned-to",
  InstructionUrl: "instruction-url",
} as const;
export type WorkDefinitionAttributeName = typeof WorkDefinitionAttributes[keyof typeof WorkDefinitionAttributes];

export const ResourceStatusAttributes = {
  Availability: "availability",
  Utilization: "utilization",
  Downtime: "downtime",
  Status: "status",
  MaintenanceStatus: "maintenance-status",
} as const;
export type ResourceStatusAttributeName = typeof ResourceStatusAttributes[keyof typeof ResourceStatusAttributes];

export const EnergyResourceAttributes = {
  Power: "power",
  Energy: "energy",
  Voltage: "voltage",
  Current: "current",
  Frequency: "frequency",
  Cost: "cost",
} as const;
export type EnergyResourceAttributeName = typeof EnergyResourceAttributes[keyof typeof EnergyResourceAttributes];

export const UtilityResourceAttributes = {
  Pressure: "pressure",
  Flow: "flow",
  Consumption: "consumption",
  Status: "status",
  Alarm: "alarm",
} as const;
export type UtilityResourceAttributeName = typeof UtilityResourceAttributes[keyof typeof UtilityResourceAttributes];

export const FluidResourceAttributes = {
  Flow: "flow",
  Pressure: "pressure",
  Temperature: "temperature",
  TotalFlow: "total-flow",
  Conductivity: "conductivity",
  PH: "ph",
} as const;
export type FluidResourceAttributeName = typeof FluidResourceAttributes[keyof typeof FluidResourceAttributes];

export const ConsumableResourceAttributes = {
  Level: "level",
  ConsumptionRate: "consumption-rate",
  RefillRequired: "refill-required",
  LastRefill: "last-refill",
  Status: "status",
} as const;
export type ConsumableResourceAttributeName = typeof ConsumableResourceAttributes[keyof typeof ConsumableResourceAttributes];

// Generic fallbacks for structural types
export const LineAttributes = { Status: "status" } as const;
export type LineAttributeName = typeof LineAttributes[keyof typeof LineAttributes];

export const AreaAttributes = { Status: "status" } as const;
export type AreaAttributeName = typeof AreaAttributes[keyof typeof AreaAttributes];

export const SiteAttributes = { Status: "status" } as const;
export type SiteAttributeName = typeof SiteAttributes[keyof typeof SiteAttributes];

export const EnterpriseAttributes = { Status: "status" } as const;
export type EnterpriseAttributeName = typeof EnterpriseAttributes[keyof typeof EnterpriseAttributes];

export const AssetAttributes = { Status: "status" } as const;
export type AssetAttributeName = typeof AssetAttributes[keyof typeof AssetAttributes];

export const SensorAttributes = {
  Status: "status",
  MeasuredTemperature: "measured-temperature",
  MeasuredVibration: "measured-vibration",
  MeasuredPressure: "measured-pressure",
  MeasuredFlow: "measured-flow",
  Temperature: "temperature",
} as const;
export type SensorAttributeName = typeof SensorAttributes[keyof typeof SensorAttributes];
