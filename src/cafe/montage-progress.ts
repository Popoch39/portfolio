/**
 * What the Montage tells the Café of its pinning while its scene runs (`montage:progress`), `null` once the scene
 * is undone: numbers it already knows, never a measure. `actionsAt` is where its actions start rising in, as a share
 * of the pinning: under it the moka is being put together again.
 */
export type MontageProgress = { progress: number; end: number; actionsAt: number } | null;
