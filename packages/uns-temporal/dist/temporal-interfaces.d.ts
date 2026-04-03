import { UnsAttributeType } from "@uns-kit/core/graphql/schema.js";
import { UnsAsset } from "@uns-kit/core/uns/uns-asset.js";
import { UnsObjectId, UnsObjectType } from "@uns-kit/core/uns/uns-object.js";
export interface ITemporalTopic {
    attribute: string;
    topic: string;
    attributeType: UnsAttributeType;
    attributeNeedsPersistence?: boolean | undefined;
    dataGroup?: string | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
    objectType: UnsObjectType;
    objectId: UnsObjectId;
    asset: UnsAsset;
}
