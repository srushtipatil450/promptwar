import { createInitialSeedData, CURRENT_SCHEMA_VERSION } from '../data/seedData';
import { AppDatabase } from '../types/lablink';

const STORAGE_KEY = 'lablink_ecosystem_db_v1';

function isValidDatabase(candidate: unknown): candidate is AppDatabase {
  if (!candidate || typeof candidate !== 'object') return false;
  const db = candidate as Partial<AppDatabase>;
  return (
    db.schemaVersion === CURRENT_SCHEMA_VERSION &&
    Array.isArray(db.users) &&
    db.users.length > 0 &&
    Array.isArray(db.equipment) &&
    Array.isArray(db.physicalUnits) &&
    Array.isArray(db.bookingRequests) &&
    Array.isArray(db.laboratories) &&
    typeof db.currentUserId === 'string' &&
    db.fairnessConfig !== undefined
  );
}

export const storageRepository = {
  load(): { db: AppDatabase; recoveredFromCorruption: boolean } {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = createInitialSeedData();
        this.save(seeded);
        return { db: seeded, recoveredFromCorruption: false };
      }

      const parsed = JSON.parse(raw);
      if (isValidDatabase(parsed)) {
        return { db: parsed, recoveredFromCorruption: false };
      }

      // Corrupted or incompatible schema version — safely re-initialize without crashing
      const seeded = createInitialSeedData();
      this.save(seeded);
      return { db: seeded, recoveredFromCorruption: true };
    } catch {
      const seeded = createInitialSeedData();
      this.save(seeded);
      return { db: seeded, recoveredFromCorruption: true };
    }
  },

  save(db: AppDatabase): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore quota exceeded errors gracefully in browser demo mode
    }
  },

  resetToDemo(): AppDatabase {
    const seeded = createInitialSeedData();
    this.save(seeded);
    return seeded;
  },
};
