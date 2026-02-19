import { Material } from "./repository/material.repo";
import { DISPLAY_FORMAT } from "../../../helpers/enums/format.enum";

export interface GeneratedContent {
  rawContent: string;
  displayFormat: DISPLAY_FORMAT;
  usedMaterialIds: string[];
  usedTags: string[];
}

export interface GenerateRequest {
  existingContent?: string;
  allMaterials: Material[];
  extraRequirements: string;
}

export interface IGenerator {
  generate(request: GenerateRequest): Promise<GeneratedContent>;
}
