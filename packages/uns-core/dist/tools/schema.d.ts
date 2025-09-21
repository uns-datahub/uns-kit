export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends {
    [key: string]: unknown;
}> = {
    [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
    [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
    [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<T extends {
    [key: string]: unknown;
}, K extends keyof T> = {
    [_ in K]?: never;
};
export type Incremental<T> = T | {
    [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: {
        input: string;
        output: string;
    };
    String: {
        input: string;
        output: string;
    };
    Boolean: {
        input: boolean;
        output: boolean;
    };
    Int: {
        input: number;
        output: number;
    };
    Float: {
        input: number;
        output: number;
    };
    Date: {
        input: any;
        output: any;
    };
};
export type ActivateMqttTranslation = {
    enabled?: InputMaybe<Scalars['Boolean']['input']>;
    sourceTag?: InputMaybe<Scalars['String']['input']>;
};
/** MQTT Translator object. */
export type AddMqttTranslation = {
    description?: InputMaybe<Scalars['String']['input']>;
    sourceTag?: InputMaybe<Scalars['String']['input']>;
    sourceTopic?: InputMaybe<Scalars['String']['input']>;
    targetTag?: InputMaybe<Scalars['String']['input']>;
    targetTopic?: InputMaybe<Scalars['String']['input']>;
    uom?: InputMaybe<Scalars['String']['input']>;
};
export type AddMqttTranslatorTopic = {
    sourceTopic?: InputMaybe<Scalars['String']['input']>;
};
export type DeleteMqttTranslation = {
    sourceTag?: InputMaybe<Scalars['String']['input']>;
};
export type DeleteMqttTranslatorTopic = {
    sourceTopic?: InputMaybe<Scalars['String']['input']>;
};
export type InitMqttTranslation = {
    sourceTag?: InputMaybe<Scalars['String']['input']>;
    sourceTopic?: InputMaybe<Scalars['String']['input']>;
};
export type InsertUnsNode = {
    parent?: InputMaybe<Scalars['Int']['input']>;
    unsNode?: InputMaybe<Scalars['String']['input']>;
};
export type ModifyMqttTranslation = {
    description?: InputMaybe<Scalars['String']['input']>;
    enabled?: InputMaybe<Scalars['Boolean']['input']>;
    sourceTag?: InputMaybe<Scalars['String']['input']>;
    targetTag?: InputMaybe<Scalars['String']['input']>;
    targetTopic?: InputMaybe<Scalars['String']['input']>;
    uom?: InputMaybe<Scalars['String']['input']>;
};
/** MQTT Translator object. */
export type MqttTranslation = {
    __typename?: 'MqttTranslation';
    description?: Maybe<Scalars['String']['output']>;
    enabled?: Maybe<Scalars['Boolean']['output']>;
    sourceTag?: Maybe<Scalars['String']['output']>;
    sourceTopic?: Maybe<Scalars['String']['output']>;
    targetTag?: Maybe<Scalars['String']['output']>;
    targetTopic?: Maybe<Scalars['String']['output']>;
    uom?: Maybe<Scalars['String']['output']>;
};
export type MqttTranslatorTopic = {
    __typename?: 'MqttTranslatorTopic';
    sourceTopic?: Maybe<Scalars['String']['output']>;
};
export type Mutation = {
    __typename?: 'Mutation';
    ActivateMqttTranslation?: Maybe<Scalars['Boolean']['output']>;
    AddMqttTranslation?: Maybe<Scalars['Boolean']['output']>;
    /** Add MQTT topic to be translated. */
    AddMqttTranslatorTopic?: Maybe<Scalars['Boolean']['output']>;
    AddUnsNode?: Maybe<Scalars['Boolean']['output']>;
    /** Add MQTT translation. */
    DeleteMqttTranslation?: Maybe<Scalars['Boolean']['output']>;
    DeleteMqttTranslatorTopic?: Maybe<Scalars['Boolean']['output']>;
    DeleteRttNode?: Maybe<Scalars['Boolean']['output']>;
    DeleteUnsNode?: Maybe<Scalars['Boolean']['output']>;
    DeployRttNode?: Maybe<Scalars['Boolean']['output']>;
    /** Populate MQTT Translator table with sourceTag and sourceTopic. */
    InitMqttTranslation?: Maybe<Scalars['Boolean']['output']>;
    /** Update MQTT Translator table with defined targetTopic. */
    ModifyMqttTranslation?: Maybe<Scalars['Boolean']['output']>;
    ModifyUnsNode?: Maybe<Scalars['Boolean']['output']>;
    StartRttNode?: Maybe<Scalars['Boolean']['output']>;
    StopRttNode?: Maybe<Scalars['Boolean']['output']>;
};
export type MutationActivateMqttTranslationArgs = {
    entry?: InputMaybe<ActivateMqttTranslation>;
};
export type MutationAddMqttTranslationArgs = {
    entry?: InputMaybe<AddMqttTranslation>;
};
export type MutationAddMqttTranslatorTopicArgs = {
    entry?: InputMaybe<AddMqttTranslatorTopic>;
};
export type MutationAddUnsNodeArgs = {
    node?: InputMaybe<InsertUnsNode>;
};
export type MutationDeleteMqttTranslationArgs = {
    entry?: InputMaybe<DeleteMqttTranslation>;
};
export type MutationDeleteMqttTranslatorTopicArgs = {
    entry?: InputMaybe<DeleteMqttTranslatorTopic>;
};
export type MutationDeleteRttNodeArgs = {
    rttNode?: InputMaybe<Scalars['String']['input']>;
};
export type MutationDeleteUnsNodeArgs = {
    id?: InputMaybe<Scalars['Int']['input']>;
};
export type MutationDeployRttNodeArgs = {
    rttNode?: InputMaybe<Scalars['String']['input']>;
    tag?: InputMaybe<Scalars['String']['input']>;
};
export type MutationInitMqttTranslationArgs = {
    entry?: InputMaybe<InitMqttTranslation>;
};
export type MutationModifyMqttTranslationArgs = {
    entry?: InputMaybe<ModifyMqttTranslation>;
};
export type MutationModifyUnsNodeArgs = {
    id?: InputMaybe<Scalars['Int']['input']>;
    node?: InputMaybe<UpdateUnsNode>;
};
export type MutationStartRttNodeArgs = {
    rttNode?: InputMaybe<Scalars['String']['input']>;
};
export type MutationStopRttNodeArgs = {
    rttNode?: InputMaybe<Scalars['String']['input']>;
};
/** name: uns-datahub */
export type Query = {
    __typename?: 'Query';
    /** Get MQTT Translator translations. */
    GetMqttTranslations?: Maybe<Array<Maybe<MqttTranslation>>>;
    GetMqttTranslatorTopics?: Maybe<Array<Maybe<MqttTranslatorTopic>>>;
    GetRttNodes?: Maybe<Array<Maybe<RttNode>>>;
    GetTreeStructure?: Maybe<Array<Maybe<TreeStructure>>>;
};
export type RttNode = {
    __typename?: 'RttNode';
    author?: Maybe<Scalars['String']['output']>;
    deployedVersions?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
    description?: Maybe<Scalars['String']['output']>;
    lastLog?: Maybe<Scalars['String']['output']>;
    latestDeployedVersion?: Maybe<Scalars['String']['output']>;
    memory?: Maybe<Scalars['Int']['output']>;
    pid?: Maybe<Scalars['Int']['output']>;
    restarts?: Maybe<Scalars['Int']['output']>;
    rttNode?: Maybe<Scalars['String']['output']>;
    runningVersion?: Maybe<Scalars['String']['output']>;
    status?: Maybe<Scalars['String']['output']>;
    uptime?: Maybe<Scalars['Int']['output']>;
    version?: Maybe<Scalars['String']['output']>;
};
export type TreeStructure = {
    __typename?: 'TreeStructure';
    children?: Maybe<Array<Maybe<TreeStructure>>>;
    id?: Maybe<Scalars['Int']['output']>;
    parent?: Maybe<Scalars['Int']['output']>;
    unsNode?: Maybe<Scalars['String']['output']>;
};
export type UnsNode = {
    __typename?: 'UnsNode';
    id?: Maybe<Scalars['Int']['output']>;
    parent?: Maybe<Scalars['Int']['output']>;
    unsNode?: Maybe<Scalars['String']['output']>;
};
export type UpdateUnsNode = {
    parent?: InputMaybe<Scalars['Int']['input']>;
    unsNode?: InputMaybe<Scalars['String']['input']>;
};
