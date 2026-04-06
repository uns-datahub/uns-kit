import { GeneratedObjectTypes } from "./uns-dictionary.generated.js";
export declare const ObjectTypes: {
    readonly "consumable-resource": "consumable-resource";
    readonly "energy-meter": "energy-meter";
    readonly "energy-resource": "energy-resource";
    readonly equipment: "equipment";
    readonly "fluid-resource": "fluid-resource";
    readonly material: "material";
    readonly personnel: "personnel";
    readonly "process-segment": "process-segment";
    readonly "product-definition": "product-definition";
    readonly "product-quality": "product-quality";
    readonly "resource-status": "resource-status";
    readonly "utility-resource": "utility-resource";
    readonly "work-definition": "work-definition";
};
export type KnownUnsObjectTypeName = keyof typeof GeneratedObjectTypes;
export type UnsObjectType = "" | KnownUnsObjectTypeName | (string & {});
export type UnsObjectId = "main" | "" | (string & {});
export declare function getObjectTypeDescription(objectType: UnsObjectType): string | undefined;
//# sourceMappingURL=uns-object.d.ts.map