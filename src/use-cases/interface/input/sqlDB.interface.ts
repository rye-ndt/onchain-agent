import { IMaterialDB } from "./repository/material.repo";
import { IOriginalNoteDB } from "./repository/originalNote.repo";

export interface IPostgresDB {
  close(): Promise<void>;
}

export interface ISqlDB extends IPostgresDB {
  originalNotes: IOriginalNoteDB;
  materials: IMaterialDB;
}
