import { PRIMARY_CATEGORY } from "../../../helpers/enums/categories.enum";

export interface IVector {
  id: string;
  vector: number[];
}
//what this system expects the outter service to do
export interface IVectorService {
  process(text: string): Promise<IVector[]>;
}

export interface ICleaner {
  process(text: string): string;
}

export interface IVectorReferenceDB {
  getVectorIDsByCategory(category: PRIMARY_CATEGORY): Promise<string[]>;
}
