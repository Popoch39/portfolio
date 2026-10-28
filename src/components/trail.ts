// La Traîne (ADR 0012) : une scène pilotée par le défilement rattrape le défilement au lieu de le suivre
// exactement, et ne s'arrête pas net quand il s'arrête. Le Glissé (ADR 0013) ne lisse que la molette,
// cran par cran : lancée puis lâchée, au pavé tactile surtout, la scène se figeait d'un coup. Toute
// scène la demande en déclarant sa piste (`data-trail`), la Visite la première. Aucune animation n'est
// réglée ici : la piste, dont la ligne de temps pilote toute la scène, est décalée de l'avance du
// défilement sur elle (`margin-top`, sa position dans le flux étant celle d'un élément absolu), et le
// navigateur joue le reste sur le compositeur. La scène, collée par la CSS, ne bouge pas avec sa piste :
// ce qui tenait Projets en Plongée, et l'a fait trembler sous un défilement écrit image par image, n'a
// pas d'équivalent ici ; une scène tenue de la même façon ne doit pas déclarer la Traîne.

// En `TAU` millisecondes, la scène fait 63 % du chemin qui la sépare du défilement : arrêté net, elle
// le rejoint en une demi-seconde environ.
const TAU = 160;

function follow(track: HTMLElement) {
	// Le défilement que montre la scène.
	let shown = scrollY;
	let last = 0;
	let frame = 0;
	let near = false;

	const step = (now: number) => {
		// Une image manquée (onglet en arrière-plan) ne fait pas sauter la scène.
		const elapsed = last ? Math.min(now - last, 100) : 16;
		last = now;
		// Au plus un tiers d'écran de retard : une ancre ou la Lunette, qui sautent loin, ne font pas
		// rejouer toute la scène, et la piste décalée ne descend pas sous le bas de la page.
		const reach = innerHeight / 3;
		shown += (scrollY - shown) * (1 - Math.exp(-elapsed / TAU));
		shown = Math.max(scrollY - reach, Math.min(scrollY + reach, shown));
		if (Math.abs(scrollY - shown) < 0.5) shown = scrollY;
		track.style.marginTop = `${scrollY - shown}px`;
		frame = shown == scrollY ? 0 : requestAnimationFrame(step);
		if (!frame) last = 0;
	};

	addEventListener(
		'scroll',
		() => {
			if (near) frame ||= requestAnimationFrame(step);
			else shown = scrollY;
		},
		{ passive: true },
	);

	// Loin de la section, ou là où la scène ne joue pas (sa piste n'y est affichée que sous ses
	// conditions, celles de la Visite : mouvement non réduit, écran assez haut, navigateur qui sait la
	// jouer), la piste reste à sa place : la décaler relancerait la mise en page de l'accueil à chaque
	// image, pour rien.
	new IntersectionObserver(
		([entry]) => {
			near = entry.isIntersecting && getComputedStyle(track).display != 'none';
			if (near) return;
			cancelAnimationFrame(frame);
			frame = last = 0;
			shown = scrollY;
			track.style.marginTop = '';
		},
		{ rootMargin: '50% 0px' },
	).observe(track.parentElement!);
}

document.querySelectorAll<HTMLElement>('[data-trail]').forEach(follow);

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
