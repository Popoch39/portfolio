import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * How the visitor scrolls, set by the project (`playwright.perf.config.ts`):
 * - `mouse`: fine pointer, wheel and Défilement lissé, CPU ×1;
 * - `finger`: touch phone, swipes and native scrolling, CPU ×4.
 */
export type Profile = 'mouse' | 'finger';

export interface ProfileOptions {
	profile: Profile;
}

export const test = base.extend<ProfileOptions>({
	profile: ['mouse', { option: true }],
});

/** CPU slowdown of each profile, as DevTools applies it. */
export const CPU_THROTTLING: Record<Profile, number> = { mouse: 1, finger: 4 };
