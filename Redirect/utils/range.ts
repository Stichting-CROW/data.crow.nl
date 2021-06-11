/** Generates a range from (start-end] */
export function* range(start: number, end: number): Generator<number> {
  yield start;
  if (start === end) return;
  yield* range(start + 1, end);
}
