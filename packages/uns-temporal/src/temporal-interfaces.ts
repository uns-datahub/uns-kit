import { UnsAttributeType } from "@uns-kit/core/graphql/schema";

export interface ITemporalTopic {
  attribute: string,
  topic: string,
  attributeType: UnsAttributeType,
  attributeNeedsPersistence?: boolean|undefined,
  dataGroup?: string|undefined,
  description?: string|undefined,
  tags?: string[]|undefined,
}
