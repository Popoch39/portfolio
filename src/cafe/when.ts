/**
 * The « Quand ? » choices of the Formulaire du Café, shared by the form's markup (`Cafe.astro`) and the route that
 * checks them (`worker/index.ts`): each is what the form sends and the route accepts, in French whatever the page's
 * language. What a chip reads is the dictionary's (`cafe.chips`).
 */
export const WHEN_CHOICES = ['Cette semaine', 'La semaine prochaine', 'Plus tard'] as const;

export type WhenValue = (typeof WHEN_CHOICES)[number];

export const WHEN_VALUES: readonly string[] = WHEN_CHOICES;
