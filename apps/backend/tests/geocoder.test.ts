import { beforeAll, describe, expect, it } from 'vitest';

// Force offline mode before any module reads the environment.
process.env.GEOCODING_ENABLED = 'false';

const { MemoryDatabase, normalizeArabic } = await import('../src/db/memory-db.js');
const { findInGazetteer, buildGazetteer } = await import('../src/services/geocoder.js');

let db: InstanceType<typeof MemoryDatabase>;
let gazetteer: Awaited<ReturnType<typeof buildGazetteer>>;

beforeAll(async () => {
  db = new MemoryDatabase();
  gazetteer = await buildGazetteer(db);
});

describe('normalizeArabic', () => {
  it('unifies alef variants and strips diacritics', () => {
    expect(normalizeArabic('أكتوبر')).toBe('اكتوبر');
    expect(normalizeArabic('القَاهِرَة')).toBe('القاهره');
    expect(normalizeArabic('الإسماعيلية')).toBe('الاسماعيليه');
  });

  it('lowercases latin text', () => {
    expect(normalizeArabic('Zagazig')).toBe('zagazig');
  });
});

describe('gazetteer resolution', () => {
  it('contains cities, areas and stops', () => {
    const kinds = new Set(gazetteer.map((g) => g.kind));
    expect(kinds.has('city')).toBe(true);
    expect(kinds.has('area')).toBe(true);
    expect(kinds.has('stop')).toBe(true);
  });

  it('resolves exact Arabic names', async () => {
    const hit = await findInGazetteer(gazetteer, 'جامعة الزقازيق');
    expect(hit?.nameAr).toBe('جامعة الزقازيق');
    expect(hit?.kind).toBe('stop');
  });

  it('resolves names with hamza variants', async () => {
    const hit = await findInGazetteer(gazetteer, 'الاسماعيلية');
    expect(hit).not.toBeNull();
    expect(hit?.nameAr).toBe('الإسماعيلية');
    expect(hit?.kind).toBe('city');
  });

  it('resolves English city names', async () => {
    const hit = await findInGazetteer(gazetteer, 'zagazig');
    expect(hit?.kind).toBe('city');
  });

  it('prefers the Zagazig Tahrir square for an unqualified query', async () => {
    const hit = await findInGazetteer(gazetteer, 'ميدان التحرير');
    expect(hit?.nameAr).toBe('ميدان التحرير');
    expect(hit?.kind).toBe('stop');
  });
});
