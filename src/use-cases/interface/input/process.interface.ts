import { PRIMARY_CATEGORY } from "../../../helpers/enums/categories.enum";
import { CONTENT_PERSIST } from "../../../helpers/enums/contentPersist.enum";
import { DISPLAY_FORMAT } from "../../../helpers/enums/format.enum";
import { MATERIAL_STATUSES } from "../../../helpers/enums/statuses.enum";
import { IVectorWithMetadata } from "../output/vectorDB.interface";
import { IPaginated } from "../shared/pagination";

// What outer service expects this service to do
export interface StandardizedData {
  id: string;
  rawData: string;
  vector: IVectorWithMetadata[];
  category: PRIMARY_CATEGORY;
  payload?: any;
  createdAtTimestamp: number;
  updatedAtTimestamp: number;
}

export interface IRawData {
  rawData: string;
  userID: string;
  requestTimestamp: number;
  requestID: string;
}

export interface IStoreResponse {
  id: string;
}

export interface IQueryData {
  page: number;
  limit: number;
  status: MATERIAL_STATUSES[];
  categories: PRIMARY_CATEGORY[];
  userId: string;
}

export interface IRetrieveContents {
  userId: string;
  category: PRIMARY_CATEGORY;
}

export interface IBuildContent {
  userId: string;
  category: PRIMARY_CATEGORY;
  extraRequirements: string;
}

export interface IRegenerateContent extends IBuildContent {
  existingContentId: string;
}

export interface IGenerateAndPersistContentParams {
  userId: string;
  category: PRIMARY_CATEGORY;
  extraRequirements: string;
  existingContent?: string;
  createdAtEpoch?: number;
  persist: CONTENT_PERSIST;
}

export interface IQueryResponse {
  rawData: string[];
  referenceVectorIDs: string[];
}

export interface IUserCategory {
  category: PRIMARY_CATEGORY;
  tags: string[];
  materialCount: number;
  totalWords: number;
  lastUpdatedAtEpoch: number;
}

export interface IBuildContentResponse {
  id: string;
  rawData: string;
  displayFormat: DISPLAY_FORMAT;
  usedMaterialIds: string[];
  usedTags: string[];
  createdAtEpoch: number;
  updatedAtEpoch: number;
}

export interface IProcessNoteUseCase {
  retrieveContents(query: IRetrieveContents): Promise<IBuildContentResponse[]>;
  buildContent(query: IBuildContent): Promise<IBuildContentResponse>;
  processAndStore(data: IRawData): Promise<IStoreResponse>;
  queryCategories(query: IQueryData): Promise<IPaginated<IUserCategory>>;
}
