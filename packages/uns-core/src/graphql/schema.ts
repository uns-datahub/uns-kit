import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Date: { input: any; output: any; }
  Timestamp: { input: any; output: any; }
};

export type InitUnsTopic = {
  topic?: InputMaybe<Scalars['String']['input']>;
};

export type InsertUnsNode = {
  apiDescription?: InputMaybe<Scalars['String']['input']>;
  apiEndpoint?: InputMaybe<Scalars['String']['input']>;
  apiMethod?: InputMaybe<Scalars['String']['input']>;
  attributeNeedsPersistance?: InputMaybe<Scalars['Boolean']['input']>;
  attributeTags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  attributeTimestamp?: InputMaybe<Scalars['Timestamp']['input']>;
  attributeType?: InputMaybe<UnsAttributeType>;
  description?: InputMaybe<Scalars['String']['input']>;
  fullTopic?: InputMaybe<Scalars['String']['input']>;
  parent: Scalars['Int']['input'];
  processName?: InputMaybe<Scalars['String']['input']>;
  processVersion?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<UnsNodeType>;
  unsNode?: InputMaybe<Scalars['String']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  AddUnsNode?: Maybe<Scalars['Int']['output']>;
  DeleteRttNode?: Maybe<Scalars['Boolean']['output']>;
  DeleteUnsNode?: Maybe<Scalars['Boolean']['output']>;
  DeployRttNode?: Maybe<Scalars['Boolean']['output']>;
  ModifyUnsNode?: Maybe<Scalars['Boolean']['output']>;
  /** Purge all nodes that are older the maxAge in hours */
  PurgeOldNodes?: Maybe<Scalars['Boolean']['output']>;
  SetRttNodeConfig?: Maybe<Scalars['Boolean']['output']>;
  StartRttNode?: Maybe<Scalars['Boolean']['output']>;
  StopRttNode?: Maybe<Scalars['Boolean']['output']>;
};


export type MutationAddUnsNodeArgs = {
  node?: InputMaybe<InsertUnsNode>;
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


export type MutationModifyUnsNodeArgs = {
  id?: InputMaybe<Scalars['Int']['input']>;
  node?: InputMaybe<UpdateUnsNode>;
};


export type MutationPurgeOldNodesArgs = {
  maxAge?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationSetRttNodeConfigArgs = {
  configuration?: InputMaybe<Scalars['String']['input']>;
  rttNode?: InputMaybe<Scalars['String']['input']>;
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
  GetRepositories?: Maybe<Array<Maybe<Repository>>>;
  GetRttNodeConfig?: Maybe<Scalars['String']['output']>;
  GetRttNodes?: Maybe<Array<Maybe<RttNode>>>;
  GetTags?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  GetTreeStructure?: Maybe<Array<Maybe<TreeStructure>>>;
  GetUnsNodes?: Maybe<Array<Maybe<UnsNode>>>;
};


/** name: uns-datahub */
export type QueryGetRttNodeConfigArgs = {
  rttNode?: InputMaybe<Scalars['String']['input']>;
};


/** name: uns-datahub */
export type QueryGetTreeStructureArgs = {
  attributeTags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type Repository = {
  __typename?: 'Repository';
  name?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type RttNode = {
  __typename?: 'RttNode';
  author?: Maybe<Scalars['String']['output']>;
  deployedVersions?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  description?: Maybe<Scalars['String']['output']>;
  lastErrLog?: Maybe<Scalars['String']['output']>;
  lastLog?: Maybe<Scalars['String']['output']>;
  latestDeployedVersion?: Maybe<Scalars['String']['output']>;
  memory?: Maybe<Scalars['Int']['output']>;
  pid?: Maybe<Scalars['Int']['output']>;
  restarts?: Maybe<Scalars['Int']['output']>;
  rttNode?: Maybe<Scalars['String']['output']>;
  runningVersion?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  topics?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  uptime?: Maybe<Scalars['Int']['output']>;
  version?: Maybe<Scalars['String']['output']>;
};

export type TreeStructure = {
  __typename?: 'TreeStructure';
  apiDescription?: Maybe<Scalars['String']['output']>;
  apiEndpoint?: Maybe<Scalars['String']['output']>;
  apiMethod?: Maybe<Scalars['String']['output']>;
  attributeNeedsPersistance?: Maybe<Scalars['Boolean']['output']>;
  attributeTags?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  attributeTimestamp?: Maybe<Scalars['Timestamp']['output']>;
  attributeType?: Maybe<UnsAttributeType>;
  children?: Maybe<Array<Maybe<TreeStructure>>>;
  description?: Maybe<Scalars['String']['output']>;
  fullTopic?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  parent?: Maybe<Scalars['Int']['output']>;
  processName?: Maybe<Scalars['String']['output']>;
  processVersion?: Maybe<Scalars['String']['output']>;
  type?: Maybe<UnsNodeType>;
  unsNode?: Maybe<Scalars['String']['output']>;
};

export enum UnsAttributeType {
  Api = 'Api',
  Data = 'Data',
  Table = 'Table'
}

export type UnsNode = {
  __typename?: 'UnsNode';
  apiDescription?: Maybe<Scalars['String']['output']>;
  apiEndpoint?: Maybe<Scalars['String']['output']>;
  apiMethod?: Maybe<Scalars['String']['output']>;
  attributeNeedsPersistance?: Maybe<Scalars['Boolean']['output']>;
  attributeTags?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  attributeTimestamp?: Maybe<Scalars['Timestamp']['output']>;
  attributeType?: Maybe<UnsAttributeType>;
  description?: Maybe<Scalars['String']['output']>;
  fullTopic?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  parent?: Maybe<Scalars['Int']['output']>;
  processName?: Maybe<Scalars['String']['output']>;
  processVersion?: Maybe<Scalars['String']['output']>;
  type?: Maybe<UnsNodeType>;
  unsNode?: Maybe<Scalars['String']['output']>;
};

export enum UnsNodeType {
  Attribute = 'Attribute',
  DynamicTopic = 'DynamicTopic',
  Topic = 'Topic'
}

export type UpdateUnsNode = {
  apiDescription?: InputMaybe<Scalars['String']['input']>;
  apiEndpoint?: InputMaybe<Scalars['String']['input']>;
  apiMethod?: InputMaybe<Scalars['String']['input']>;
  attributeNeedsPersistance?: InputMaybe<Scalars['Boolean']['input']>;
  attributeTags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  attributeTimestamp?: InputMaybe<Scalars['Timestamp']['input']>;
  attributeType?: InputMaybe<UnsAttributeType>;
  description?: InputMaybe<Scalars['String']['input']>;
  fullTopic?: InputMaybe<Scalars['String']['input']>;
  parent?: InputMaybe<Scalars['Int']['input']>;
  processName?: InputMaybe<Scalars['String']['input']>;
  processVersion?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<UnsNodeType>;
  unsNode?: InputMaybe<Scalars['String']['input']>;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  InitUnsTopic: InitUnsTopic;
  InsertUnsNode: InsertUnsNode;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  Query: ResolverTypeWrapper<{}>;
  Repository: ResolverTypeWrapper<Repository>;
  RttNode: ResolverTypeWrapper<RttNode>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Timestamp: ResolverTypeWrapper<Scalars['Timestamp']['output']>;
  TreeStructure: ResolverTypeWrapper<TreeStructure>;
  UnsAttributeType: UnsAttributeType;
  UnsNode: ResolverTypeWrapper<UnsNode>;
  UnsNodeType: UnsNodeType;
  UpdateUnsNode: UpdateUnsNode;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean']['output'];
  Date: Scalars['Date']['output'];
  InitUnsTopic: InitUnsTopic;
  InsertUnsNode: InsertUnsNode;
  Int: Scalars['Int']['output'];
  Mutation: {};
  Query: {};
  Repository: Repository;
  RttNode: RttNode;
  String: Scalars['String']['output'];
  Timestamp: Scalars['Timestamp']['output'];
  TreeStructure: TreeStructure;
  UnsNode: UnsNode;
  UpdateUnsNode: UpdateUnsNode;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  AddUnsNode?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType, Partial<MutationAddUnsNodeArgs>>;
  DeleteRttNode?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationDeleteRttNodeArgs>>;
  DeleteUnsNode?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationDeleteUnsNodeArgs>>;
  DeployRttNode?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationDeployRttNodeArgs>>;
  ModifyUnsNode?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationModifyUnsNodeArgs>>;
  PurgeOldNodes?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationPurgeOldNodesArgs>>;
  SetRttNodeConfig?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationSetRttNodeConfigArgs>>;
  StartRttNode?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationStartRttNodeArgs>>;
  StopRttNode?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationStopRttNodeArgs>>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  GetRepositories?: Resolver<Maybe<Array<Maybe<ResolversTypes['Repository']>>>, ParentType, ContextType>;
  GetRttNodeConfig?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, Partial<QueryGetRttNodeConfigArgs>>;
  GetRttNodes?: Resolver<Maybe<Array<Maybe<ResolversTypes['RttNode']>>>, ParentType, ContextType>;
  GetTags?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  GetTreeStructure?: Resolver<Maybe<Array<Maybe<ResolversTypes['TreeStructure']>>>, ParentType, ContextType, Partial<QueryGetTreeStructureArgs>>;
  GetUnsNodes?: Resolver<Maybe<Array<Maybe<ResolversTypes['UnsNode']>>>, ParentType, ContextType>;
};

export type RepositoryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Repository'] = ResolversParentTypes['Repository']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tags?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type RttNodeResolvers<ContextType = any, ParentType extends ResolversParentTypes['RttNode'] = ResolversParentTypes['RttNode']> = {
  author?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  deployedVersions?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastErrLog?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastLog?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  latestDeployedVersion?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  memory?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pid?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  restarts?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  rttNode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  runningVersion?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  topics?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  uptime?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  version?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface TimestampScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Timestamp'], any> {
  name: 'Timestamp';
}

export type TreeStructureResolvers<ContextType = any, ParentType extends ResolversParentTypes['TreeStructure'] = ResolversParentTypes['TreeStructure']> = {
  apiDescription?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  apiEndpoint?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  apiMethod?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  attributeNeedsPersistance?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  attributeTags?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  attributeTimestamp?: Resolver<Maybe<ResolversTypes['Timestamp']>, ParentType, ContextType>;
  attributeType?: Resolver<Maybe<ResolversTypes['UnsAttributeType']>, ParentType, ContextType>;
  children?: Resolver<Maybe<Array<Maybe<ResolversTypes['TreeStructure']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  fullTopic?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  processName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  processVersion?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['UnsNodeType']>, ParentType, ContextType>;
  unsNode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UnsNodeResolvers<ContextType = any, ParentType extends ResolversParentTypes['UnsNode'] = ResolversParentTypes['UnsNode']> = {
  apiDescription?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  apiEndpoint?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  apiMethod?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  attributeNeedsPersistance?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  attributeTags?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  attributeTimestamp?: Resolver<Maybe<ResolversTypes['Timestamp']>, ParentType, ContextType>;
  attributeType?: Resolver<Maybe<ResolversTypes['UnsAttributeType']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  fullTopic?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  parent?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  processName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  processVersion?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['UnsNodeType']>, ParentType, ContextType>;
  unsNode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Date?: GraphQLScalarType;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Repository?: RepositoryResolvers<ContextType>;
  RttNode?: RttNodeResolvers<ContextType>;
  Timestamp?: GraphQLScalarType;
  TreeStructure?: TreeStructureResolvers<ContextType>;
  UnsNode?: UnsNodeResolvers<ContextType>;
};
