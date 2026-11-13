/**
 * The « Quand ? » choices of the Formulaire du Café, shared by the form's markup (`Cafe.astro`) and the route that
 * checks them (`worker/index.ts`): `value` is what the form sends and the route accepts, `chip` what the chip reads.
 */
export const WHEN_CHOICES = [
	{ value: 'Cette semaine', chip: 'Cette semaine' },
	{ value: 'La semaine prochaine', chip: 'Semaine prochaine' },
	{ value: 'Plus tard', chip: 'Plus tard' },
] as const;

export const WHEN_VALUES: readonly string[] = WHEN_CHOICES.map(({ value }) => value);
