// L'écouteur du Buffer (#120), tout ce qu'il coûte à l'accueil : au premier focus dans le formulaire, il
// importe le script du Buffer, comme la Lunette à sa première commande (ADR 0007). D'ici là, et sans
// script, le formulaire s'envoie nativement (ADR 0016).
const form = document.querySelector<HTMLFormElement>('.contact form');

if (form) {
	// L'instant du premier focus, sur l'horloge de `performance.now()` : le Worker tient pour robot un
	// Buffer envoyé trop vite après.
	const wake = ({ timeStamp }: Event) =>
		import('./buffer.ts').then(
			(module) => module.start(form, timeStamp),
			// Hors ligne, par exemple : le prochain focus retentera l'import.
			() => form.addEventListener('focusin', wake, { once: true }),
		);
	form.addEventListener('focusin', wake, { once: true });
}
