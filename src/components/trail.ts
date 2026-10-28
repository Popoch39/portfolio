// La Traîne de la Visite (ADR 0012) : la scène rattrape le défilement au lieu de le suivre exactement,
// et ne s'arrête pas net quand il s'arrête. Le Glissé (ADR 0013) ne lisse que la molette, cran par cran :
// lancée puis lâchée, au pavé tactile surtout, la Visite se figeait d'un coup. Aucune animation n'est
// réglée ici : la piste, dont la ligne de temps pilote toute la Visite, est décalée de l'avance du
// défilement sur la scène (`margin-top`, sa position dans le flux étant celle d'un élément absolu), et
// le navigateur joue le reste sur le compositeur. La scène, collée par la CSS, ne bouge pas avec elle :
// ce qui tenait Projets en Plongée, et l'a fait trembler sous un défilement écrit image par image, n'a
// pas d'équivalent ici.

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
		// rejouer toute la Visite, et la piste décalée ne descend pas sous le bas de la page.
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

	// Loin de la section, ou là où la Visite ne joue pas (la piste n'y est affichée que sous ses
	// conditions : mouvement non réduit, écran assez haut, navigateur qui sait la jouer), la piste reste à
	// sa place : la décaler relancerait la mise en page de l'accueil à chaque image, pour rien.
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

const track = document.querySelector<HTMLElement>('.visit-track');
if (track) follow(track);

// Un module, importé pour ses effets : ses noms ne débordent pas sur ceux de la page.
export {};
