export const knownUnsObjectTypes = [
    "equipment",
    "material",
    "personnel",
    "process-segment",
    "product-definition",
    "product-quality",
    "work-definition",
    "resource-status",
    "energy-resource",
    "utility-resource",
    "fluid-resource",
    "consumable-resource",
    "line",
    "area",
    "site",
    "enterprise",
    "asset",
    "sensor",
];
export const ObjectTypes = {
    /** Physical equipment (machines, furnaces, sensors) */
    Equipment: "equipment",
    /** Material lots/batches/raw materials */
    Material: "material",
    /** Operators/supervisors/technologists */
    Personnel: "personnel",
    /** Process step or activity (e.g., rolling, cooling) */
    ProcessSegment: "process-segment",
    /** Product specs/recipes/definitions */
    ProductDefinition: "product-definition",
    /** Quality indicators/results for a product */
    ProductQuality: "product-quality",
    /** Work/task definitions or workflows */
    WorkDefinition: "work-definition",
    /** Status of any resource (material/personnel/equipment) */
    ResourceStatus: "resource-status",
    /** Energy carriers (electricity/steam/gas) */
    EnergyResource: "energy-resource",
    /** Utilities (water/air/nitrogen/etc.) */
    UtilityResource: "utility-resource",
    /** Fluids/gases (non-energy) used in process */
    FluidResource: "fluid-resource",
    /** Consumables (lubricants/cleaners) */
    ConsumableResource: "consumable-resource",
    /** Production line/work unit */
    Line: "line",
    /** Area/department within a site */
    Area: "area",
    /** Plant/site identifier */
    Site: "site",
    /** Enterprise/company identifier */
    Enterprise: "enterprise",
    /** Generic asset placeholder */
    Asset: "asset",
    /** Sensor as a distinct object */
    Sensor: "sensor",
};
