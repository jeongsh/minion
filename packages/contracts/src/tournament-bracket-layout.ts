export const SWISS_GROUP_POSITIONS: Record<string, { column: number; row: number; span: number }> = {
  "0-0": { column: 1, row: 7, span: 36 },
  "1-0": { column: 2, row: 3, span: 21 }, "0-1": { column: 2, row: 26, span: 21 },
  "2-0": { column: 3, row: 1, span: 12 }, "1-1": { column: 3, row: 15, span: 20 }, "0-2": { column: 3, row: 37, span: 12 },
  "2-1": { column: 4, row: 9, span: 17 }, "1-2": { column: 4, row: 27, span: 17 },
  "2-2": { column: 5, row: 20, span: 17 },
};
export const SWISS_RESULT_POSITIONS = [
  { wins: 3, losses: 0, column: 4, row: 1, span: 6, from: "2-0", count: 2 },
  { wins: 0, losses: 3, column: 4, row: 44, span: 4, from: "0-2", count: 2 },
  { wins: 3, losses: 1, column: 5, row: 7, span: 4, from: "2-1", count: 3 },
  { wins: 1, losses: 3, column: 5, row: 41, span: 4, from: "1-2", count: 3 },
  { wins: 3, losses: 2, column: 6, row: 21, span: 4, from: "2-2", count: 3 },
  { wins: 2, losses: 3, column: 6, row: 33, span: 4, from: "2-2", count: 3 },
];
