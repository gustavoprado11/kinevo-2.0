/**
 * Superset-aware sorting for workout exercise items.
 *
 * Exercises that belong to a superset (have a parent_item_id) are positioned
 * at their parent's order_index (effectiveOrder), then sub-sorted by their
 * own order_index (subOrder). Normal exercises use their order_index directly.
 *
 * Used by both useWorkoutSession (phone workout screen) and
 * getProgramSnapshotForWatch (Watch program sync).
 */

export interface SortableItem {
  order_index: number;
  parent_item_id: string | null;
  [key: string]: any;
}

export interface SupersetOrderMap {
  get(parentId: string): { order_index: number } | undefined;
}

export function sortExerciseItems<T extends SortableItem>(
  items: T[],
  supersetMap: SupersetOrderMap,
): (T & { effectiveOrder: number; subOrder: number })[] {
  return items
    .map((item) => {
      const parentOrder = item.parent_item_id
        ? supersetMap.get(item.parent_item_id)?.order_index
        : undefined;
      return {
        ...item,
        effectiveOrder: parentOrder ?? item.order_index,
        subOrder: parentOrder != null ? item.order_index : 0,
      };
    })
    .sort((a, b) => a.effectiveOrder - b.effectiveOrder || a.subOrder - b.subOrder);
}
