export function dedupeById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  records: T[]
) {
  const map = new Map<string, T>();

  records.forEach((record) => {
    const existing = map.get(record.id);

    if (!existing) {
      map.set(record.id, record);
      return;
    }

    const existingTime = existing.updatedAt ?? existing.createdAt ?? "";
    const recordTime = record.updatedAt ?? record.createdAt ?? "";

    if (recordTime >= existingTime) {
      map.set(record.id, record);
    }
  });

  return Array.from(map.values());
}
