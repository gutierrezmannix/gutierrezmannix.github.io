// id → handler(ctx). Method modules call register(['id1','id2'], fn).
export const REGISTRY = new Map();
export function register(ids, fn) { for (const id of [].concat(ids)) REGISTRY.set(id, fn); }
