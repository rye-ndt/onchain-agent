import { newUuid } from "../../helpers/uuid";
import { newCurrentUTCEpoch } from "../../helpers/time/dateTime";
import {
  IProcessUserRequest,
  IQueryData,
  IQueryResponse,
  IRawData,
  IStoreResponse,
  StandardizedData,
} from "../interface/output/process.interface";

import { IError } from "../interface/input/error.interface";
import { IChunker } from "../interface/input/chunker.interface";
import { ICategorizer } from "../interface/input/categorizer.interface";
import {
  IVectorDB,
  IVectorizer,
} from "../interface/input/vectorizer.interface";

//defines what user can do to interact with the system
export class ProcessUserRequest implements IProcessUserRequest {
  private vectorizer: IVectorizer;
  private categorizer: ICategorizer;
  private chunker: IChunker;
  private vectorDB: IVectorDB;
  private sqlDB: IPostgresDB;

  //user can store, retrieve and request for aggregation / compilation
  constructor(
    vectorizer: IVectorizer,
    categorizer: ICategorizer,
    chunker: IChunker,
    vectorDB: IVectorDB,
  ) {
    this.vectorizer = vectorizer;
    this.categorizer = categorizer;
    this.chunker = chunker;
  }

  async processAndStore(data: IRawData): Promise<IStoreResponse> {
    try {
      //vectorize
      const chunks = await this.chunker.process(data.rawData);

      const categorizedChunks = await this.categorizer.batchProcess(chunks);

      const chunkVectors = await this.vectorizer.batchProcess(chunks);

      //store the data
      const storeData: StandardizedData = {
        id: newUuid(),
        rawData: data.rawData,
        vector: flattenedVectors,
        category: category,
        createdAtTimestamp: newCurrentUTCEpoch(),
        updatedAtTimestamp: newCurrentUTCEpoch(),
      };

      await this.vectorDB.store(storeData);

      return {
        id: storeData.id,
      };
    } catch (err) {
      if (err instanceof IError) {
        throw err;
      }

      throw new IError(
        "An unknown error occurred while processing and storing data.",
      );
    }
  }

  async query(query: IQueryData): Promise<IQueryResponse> {
    try {
      //categorize the query
      const category = await this.categorizer.queryCategoryFromRequest(
        query.rawQuery,
      );

      const queryVectors = await this.vectorizer.process(query.rawQuery);

      //query and response
      const queryResponse = await this.vectorDB.retrieve(
        category,
        queryVectors,
      );

      return {
        rawData: queryResponse.map((data) => data.rawData),
        referenceVectorIDs: queryResponse.map((data) => data.id),
      };

      //query and response
    } catch (err) {
      if (err instanceof IError) {
        throw err;
      }

      throw new IError("An unknown error occurred while querying the data.");
    }
  }
}
