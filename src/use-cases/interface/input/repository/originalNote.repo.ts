import { NOTE_TYPE } from "../../../../helpers/enums/noteType.enum";

export type OriginalNote = {
  id: string;
  userId: string;
  rawData: string;
  imageUrl?: string;
  type: NOTE_TYPE;
  createdAtEpoch: number;
  updatedAtEpoch: number;
};

export interface IOriginalNoteDB {
  create(note: OriginalNote): Promise<void>;
  findById(id: string): Promise<OriginalNote>;
  findByIds(ids: string[]): Promise<OriginalNote[]>;
}
