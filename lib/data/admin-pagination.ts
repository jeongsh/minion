export const ADMIN_PAGE_SIZE = 50;

export function adminPageNumber(value: string | number | undefined) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}

type PageResponse<Row> = {
  data: Row[] | null;
  count: number | null;
  error: { message: string; code?: string } | null;
};

/** Query factories must apply the same filters and a stable order, ending in id. */
export async function readAdminPage<Row>(
  requestedPage: string | number | undefined,
  pageSize: number,
  read: (from: number, to: number) => PromiseLike<PageResponse<Row>>,
) {
  const requested = adminPageNumber(requestedPage);
  // Bound offsets before sending untrusted URL parameters to PostgREST.
  const page = Math.min(requested, Math.floor(2_000_000_000 / pageSize));
  let result = await read((page - 1) * pageSize, page * pageSize - 1);
  // An offset beyond the end can return PGRST103 without a count. The first
  // page gives us the current count after deletions or an invalid URL.
  if (result.error?.code === "PGRST103") result = await read(0, pageSize - 1);
  if (result.error) throw result.error;
  if (result.count === null) throw new Error("Admin pagination requires an exact count.");
  const totalCount = result.count;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page && safePage > 1) {
    result = await read((safePage - 1) * pageSize, safePage * pageSize - 1);
    if (result.error) throw result.error;
  } else if (safePage !== page && result.data?.length === 0 && totalCount > 0) {
    result = await read(0, pageSize - 1);
    if (result.error) throw result.error;
  }
  return { rows: result.data ?? [], totalCount, totalPages, page: safePage };
}
