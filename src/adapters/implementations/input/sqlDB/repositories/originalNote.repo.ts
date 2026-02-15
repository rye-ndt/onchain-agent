import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  IOriginalNoteDB,
  OriginalNote,
  OriginalNoteCreate,
} from "../../../../../use-cases/interface/input/sqlDB.interface";
import { originalNotes } from "../schema";

export class DrizzleOriginalNoteRepo implements IOriginalNoteDB {
  constructor(private readonly db: NodePgDatabase) {}

  async create(note: OriginalNoteCreate): Promise<void> {
    await this.db.insert(originalNotes).values(note);
  }

  async findById(id: string): Promise<OriginalNote | null> {
    const rows = await this.db
      .select()
      .from(originalNotes)
      .where(eq(originalNotes.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async findLatestByUserId(
    userId: string,
    limit: number,
  ): Promise<OriginalNote[]> {
    return await this.db
      .select()
      .from(originalNotes)
      .where(eq(originalNotes.userId, userId))
      .orderBy(desc(originalNotes.createdAtTimestamp))
      .limit(limit);
  }
}
