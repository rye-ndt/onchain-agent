import { PRIMARY_CATEGORY } from "../../../../helpers/enums/categories.enum";
import { DISPLAY_FORMAT } from "../../../../helpers/enums/format.enum";

export interface GeneratedContentDB {
  id: string;
  userId: string;
  category: PRIMARY_CATEGORY;
  tags: string[];
  content: string;
  displayFormat: DISPLAY_FORMAT;
  materialIDs: string[];
  createdAtEpoch: number;
  updatedAtEpoch: number;
}

export interface IGeneratedContentDB {
  create(generatedContent: GeneratedContentDB): Promise<void>;
  update(generatedContent: GeneratedContentDB): Promise<void>;
  retrieve(
    userId: string,
    category: PRIMARY_CATEGORY,
  ): Promise<GeneratedContentDB[]>;
  getById(id: string): Promise<GeneratedContentDB>;
}
