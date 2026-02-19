import { newUuid } from "../../helpers/uuid";
import Redis from "ioredis";
import {
  IBuildContent,
  IBuildContentResponse,
  IGenerateAndPersistContentParams,
  IProcessNoteUseCase,
  IQueryData,
  IQueryResponse,
  IRawData,
  IRegenerateContent,
  IRetrieveContents,
  IStoreResponse,
  IUserCategory,
} from "../interface/input/process.interface";

import { IError } from "../interface/shared/error";
import { IChunker, TextChunk } from "../interface/output/chunker.interface";
import {
  ICategorizer,
  CategorizedItem,
} from "../interface/output/categorizer.interface";
import type {
  IVectorDB,
  IVectorWithMetadata,
} from "../interface/output/vectorDB.interface";
import {
  IVectorizer,
  ChunkVector,
} from "../interface/output/vectorizer.interface";
import { ISqlDB, ITransaction } from "../interface/output/sqlDB.interface";
import {
  IListMaterialFilters,
  IMaterialDB,
  IMaterialVector,
  IMaterialVectorDB,
  Material,
} from "../interface/output/repository/material.repo";
import {
  IOriginalNoteDB,
  OriginalNote,
} from "../interface/output/repository/originalNote.repo";
import { newCurrentUTCEpoch } from "../../helpers/time/dateTime";
import { MATERIAL_STATUSES } from "../../helpers/enums/statuses.enum";
import { PRIMARY_CATEGORY } from "../../helpers/enums/categories.enum";
import { IPaginated } from "../interface/shared/pagination";
import {
  CACHE_KEY_PREFIX,
  CACHE_TTL_SECONDS,
} from "../../helpers/enums/cache.enum";
import {
  GeneratedContentDB,
  IGeneratedContentDB,
} from "../interface/output/repository/generatedContent.repo";
import { DISPLAY_FORMAT } from "../../helpers/enums/format.enum";
import {
  GeneratedContent,
  IGenerator,
} from "../interface/output/generator.interface";
import { CONTENT_PERSIST } from "../../helpers/enums/contentPersist.enum";
import { ERROR_CODES } from "../../helpers/enums/errorCodes.enum";

const queryCategoriesRedis = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
);

const queryCategoriesCacheKey = (query: IQueryData): string => {
  const statusPart = query.status.join(",");
  const categoriesPart = query.categories.join(",");

  return `${CACHE_KEY_PREFIX.QUERY_CATEGORIES}${query.userId}:${statusPart}:${categoriesPart}:${query.page}:${query.limit}`;
};

const queryCategoriesCacheTtlSeconds = (): number => {
  const fromEnv = Number(process.env.QUERY_CATEGORIES_CACHE_TTL_SECONDS);
  if (!Number.isNaN(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }

  return CACHE_TTL_SECONDS.QUERY_CATEGORIES_DEFAULT;
};

interface PipelineResult {
  chunks: TextChunk[];
  categorizedByChunkId: Map<string, CategorizedItem>;
  chunkVectors: ChunkVector[];
}

interface UserMaterialData {
  userId: string;
  originalNote: OriginalNote;
  originalNoteId: string;
  materials: Material[];
  materialVectors: IMaterialVector[];
  vectors: IVectorWithMetadata[];
}

//defines what user can do to interact with the system
export class ProcessUserRequest implements IProcessNoteUseCase {
  //user can store, retrieve and request for aggregation / compilation
  constructor(
    private readonly vectorizer: IVectorizer,
    private readonly categorizer: ICategorizer,
    private readonly chunker: IChunker,
    private readonly vectorDB: IVectorDB,
    private readonly sqlDB: ISqlDB,
    private readonly materialRepo: IMaterialDB,
    private readonly materialVectorRepo: IMaterialVectorDB,
    private readonly originalNoteRepo: IOriginalNoteDB,
    private readonly contentRepo: IGeneratedContentDB,
    private readonly generator: IGenerator,
  ) {}

  async retrieveContents(
    query: IRetrieveContents,
  ): Promise<IBuildContentResponse[]> {
    //find the content in the db
    const contents = await this.contentRepo.retrieve(
      query.userId,
      query.category,
    );

    const resp: IBuildContentResponse[] = contents.map((c) => ({
      id: c.id,
      rawData: c.content,
      displayFormat: c.displayFormat,
      usedMaterialIds: c.materialIDs,
      usedTags: c.tags,
      createdAtEpoch: c.createdAtEpoch,
      updatedAtEpoch: c.updatedAtEpoch,
    }));

    return resp;
  }

  private async generateAndPersistContent(
    params: IGenerateAndPersistContentParams,
  ): Promise<IBuildContentResponse> {
    const { userId, category, extraRequirements, persist } = params;
    const now = newCurrentUTCEpoch();
    const createdAtEpoch = params.createdAtEpoch ?? now;

    const materials = await this.materialRepo.findByCategory(userId, category, [
      MATERIAL_STATUSES.ACTIVE,
    ]);

    const content = await this.generator.generate({
      allMaterials: materials,
      extraRequirements,
      ...(params.existingContent && {
        existingContent: params.existingContent,
      }),
    });

    const contentEntity: GeneratedContentDB = {
      id: newUuid(),
      userId,
      category,
      tags: content.usedTags,
      content: content.rawContent,
      displayFormat: content.displayFormat,
      materialIDs: content.usedMaterialIds,
      createdAtEpoch,
      updatedAtEpoch: now,
    };

    if (persist === CONTENT_PERSIST.CREATE) {
      await this.contentRepo.create(contentEntity);
    } else {
      await this.contentRepo.update(contentEntity);
    }

    return {
      id: contentEntity.id,
      rawData: content.rawContent,
      displayFormat: content.displayFormat,
      usedMaterialIds: content.usedMaterialIds,
      usedTags: content.usedTags,
      createdAtEpoch: contentEntity.createdAtEpoch,
      updatedAtEpoch: contentEntity.updatedAtEpoch,
    };
  }

  async buildContentBaseOnExistingContents(
    query: IRegenerateContent,
  ): Promise<IBuildContentResponse> {
    const existingContent = await this.contentRepo.getById(
      query.existingContentId,
    );

    if (!existingContent) {
      throw new IError(ERROR_CODES.CONTENT_NOT_FOUND);
    }

    return this.generateAndPersistContent({
      userId: query.userId,
      category: query.category,
      extraRequirements: query.extraRequirements,
      existingContent: existingContent.content,
      createdAtEpoch: existingContent.createdAtEpoch,
      persist: CONTENT_PERSIST.UPDATE,
    });
  }

  async buildContent(query: IBuildContent): Promise<IBuildContentResponse> {
    return this.generateAndPersistContent({
      userId: query.userId,
      category: query.category,
      extraRequirements: query.extraRequirements,
      persist: CONTENT_PERSIST.CREATE,
    });
  }

  //how do you know what content to generate?
  // -> api to suggest user contents they should care about

  async queryCategories(query: IQueryData): Promise<IPaginated<IUserCategory>> {
    const cacheKey = queryCategoriesCacheKey(query);
    const cached = await queryCategoriesRedis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as IPaginated<IUserCategory>;
    }

    const queryParams: IListMaterialFilters = {
      userId: query.userId,
      status: query.status,
      categories: query.categories,
      page: query.page,
      limit: query.limit,
    };

    const materials = await this.materialRepo.list(queryParams);

    const categoryMap = new Map<PRIMARY_CATEGORY, IUserCategory>();

    for (const m of materials.items) {
      const existing = categoryMap.get(m.category);

      const wordCount = m.rewrittenContent.trim()
        ? m.rewrittenContent.trim().split(/\s+/).length
        : 0;

      if (!existing) {
        const tags = Array.from(new Set(m.tags));

        categoryMap.set(m.category, {
          category: m.category,
          tags,
          materialCount: 1,
          totalWords: wordCount,
          lastUpdatedAtEpoch: m.updatedAtEpoch,
        });

        continue;
      }

      existing.materialCount += 1;
      existing.totalWords += wordCount;
      existing.lastUpdatedAtEpoch = Math.max(
        existing.lastUpdatedAtEpoch,
        m.updatedAtEpoch,
      );

      const mergedTags = new Set<string>([...existing.tags, ...m.tags]);
      existing.tags = Array.from(mergedTags);
    }

    const items = Array.from(categoryMap.values());

    const result: IPaginated<IUserCategory> = {
      items,
      total: items.length,
      page: query.page,
      limit: query.limit,
      hasMore: materials.total > query.page * query.limit,
    };

    await queryCategoriesRedis.setex(
      cacheKey,
      queryCategoriesCacheTtlSeconds(),
      JSON.stringify(result),
    );

    return result;
  }

  async processAndStore(data: IRawData): Promise<IStoreResponse> {
    try {
      const pipeline = await this.runPipeline(data.rawData);
      const tx = await this.sqlDB.beginTransaction();
      const originalNoteId = newUuid();

      try {
        const userData = this.buildUserMaterialData(
          data,
          originalNoteId,
          pipeline,
        );

        await this.persistUserMaterialData(tx, userData);
      } catch (err) {
        await tx.rollback();
        throw err;
      }

      return { id: originalNoteId };
    } catch (err) {
      if (err instanceof IError) {
        throw err;
      }

      throw new IError(
        "An unknown error occurred while processing and storing data.",
      );
    }
  }

  private async runPipeline(rawData: string): Promise<PipelineResult> {
    const chunks = await this.chunker.process(rawData);
    const categorizedChunks = await this.categorizer.batchProcess(chunks);
    const categorizedByChunkId = new Map(
      categorizedChunks.map((c) => [c.chunkId, c]),
    );
    const chunkVectors = await this.vectorizer.batchProcess(chunks);

    return { chunks, categorizedByChunkId, chunkVectors };
  }

  private buildUserMaterialData(
    data: IRawData,
    originalNoteId: string,
    pipeline: PipelineResult,
  ): UserMaterialData {
    const { chunks, categorizedByChunkId, chunkVectors } = pipeline;

    const originalNote: OriginalNote = {
      id: originalNoteId,
      userId: data.userID,
      rawData: data.rawData,
      createdAtTimestamp: newCurrentUTCEpoch(),
      updatedAtTimestamp: newCurrentUTCEpoch(),
    };

    const materials: Material[] = [];
    const materialVectors: IMaterialVector[] = [];
    const vectors: IVectorWithMetadata[] = [];

    for (const c of chunks) {
      const cate = categorizedByChunkId.get(c.id);
      const materialId = newUuid();
      const chunkVector = chunkVectors.find((v) => v.chunkId === c.id);
      const vectorId = newUuid();

      materials.push({
        id: materialId,
        userId: data.userID,
        originalNoteId,
        category: cate?.category ?? PRIMARY_CATEGORY.OTHER,
        tags: cate?.tags || [],
        rewrittenContent: c.chunkText,
        originalContent: c.originalText,
        status: MATERIAL_STATUSES.ACTIVE,
        createdAtEpoch: newCurrentUTCEpoch(),
        updatedAtEpoch: newCurrentUTCEpoch(),
      });

      materialVectors.push({
        id: newUuid(),
        materialId,
        vectorId,
        createdAtEpoch: newCurrentUTCEpoch(),
        updatedAtEpoch: newCurrentUTCEpoch(),
      });

      vectors.push({
        id: vectorId,
        chunkId: c.id,
        vector: chunkVector?.vector || [],
        metadata: {
          userId: data.userID,
          primaryCategory: cate?.category ?? PRIMARY_CATEGORY.OTHER,
          tags: cate?.tags || [],
        },
      });
    }

    return {
      userId: data.userID,
      originalNote,
      originalNoteId,
      materials,
      materialVectors,
      vectors,
    };
  }

  private async persistUserMaterialData(
    tx: ITransaction,
    userData: UserMaterialData,
  ): Promise<void> {
    await tx.run(async () => {
      await this.materialRepo.batchCreate(userData.materials);
      await this.materialVectorRepo.batchCreate(userData.materialVectors);
      await this.originalNoteRepo.create(userData.originalNote);
      await this.vectorDB.store(userData.vectors);
    });
  }
}
