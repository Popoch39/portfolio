import type { Page } from '@playwright/test';

export const cafeSection = (page: Page) =>
	page.getByRole('region', { name: 'Parlons de votre projet autour d’un café.', exact: true });

/** The moka on its stove, announced as a single image. */
export const montageFigure = (page: Page) => cafeSection(page).getByRole('img', { name: /Moka Express/ });
