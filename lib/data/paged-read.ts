export async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input) => Promise<Output>,
): Promise<Output[]> {
  const output = new Array<Output>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await mapper(values[index]);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    () => worker(),
  ));
  return output;
}

export type CountedPage<Row> = {
  rows: Row[];
  /** Exact count after all filters, including the keyset cursor; null falls back to EOF. */
  count: number | null;
};

/** Do not infer EOF from a short page: PostgREST may cap below the requested limit. */
export async function collectCountedKeysetPages<Row extends { id: string }>(
  readPage: (afterId: string | null) => Promise<CountedPage<Row>>,
): Promise<Row[]> {
  const rows: Row[] = [];
  let afterId: string | null = null;
  while (true) {
    const page = await readPage(afterId);
    if (page.rows.length === 0) return rows;
    const nextAfterId = page.rows.at(-1)!.id;
    if (!nextAfterId || (afterId !== null && nextAfterId <= afterId)) {
      throw new Error("Keyset pagination did not advance.");
    }
    rows.push(...page.rows);
    if (page.count !== null && page.rows.length >= page.count) return rows;
    afterId = nextAfterId;
  }
}

// Fixed, disjoint UUID ranges keep public fact caches shared by every screen/filter.
// Unlike offset pages they cannot shift or overlap when earlier rows are inserted.
export const UUID_READ_PARTITIONS = [
  ["00000000-0000-0000-0000-000000000000", "40000000-0000-0000-0000-000000000000"],
  ["40000000-0000-0000-0000-000000000000", "80000000-0000-0000-0000-000000000000"],
  ["80000000-0000-0000-0000-000000000000", "c0000000-0000-0000-0000-000000000000"],
  ["c0000000-0000-0000-0000-000000000000", null],
] as const;

export async function collectUuidPartitions<Row extends { id: string }>(
  readPage: (lowerId: string, upperId: string | null, afterId: string | null) => Promise<CountedPage<Row>>,
): Promise<Row[]> {
  const partitions = await mapWithConcurrency(UUID_READ_PARTITIONS, 4, ([lowerId, upperId]) =>
    collectCountedKeysetPages((afterId) => readPage(lowerId, upperId, afterId)),
  );
  return partitions.flat();
}
