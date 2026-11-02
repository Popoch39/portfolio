/**
 * Socle d'animation : seul point d'entrée de GSAP sur le site (ADR 0001).
 * Chargé par le layout sur chaque page ; le bundler en fait un chunk unique, mis en cache entre les pages.
 */
import { gsap } from 'gsap';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// Tout ce qui bouge vit dans ce contexte : rien n'est créé sous `reduce`, et tout est
// annulé (styles inline compris) dès que la préférence bascule, sans recharger.
const MOUVEMENT_AUTORISE = '(prefers-reduced-motion: no-preference)';
const mouvement = gsap.matchMedia();

mouvement.add(MOUVEMENT_AUTORISE, () => {
	const smoother = ScrollSmoother.create({
		wrapper: '#smooth-wrapper',
		content: '#smooth-content',
		smooth: 1,
		// Au doigt, le défilement natif reste sous le doigt : un lissage y ferait traîner la page.
		smoothTouch: false,
	});
	return suivreLesAncres(smoother);
});

// Hors du contexte : l'ancre d'arrivée ne vaut qu'au chargement, une bascule de préférence
// plus tard ne doit pas y ramener. Sans smoother (mouvement réduit), le navigateur s'en charge.
const cibleDArrivee = cibleDeLAncre(location.hash);
if (cibleDArrivee) ScrollSmoother.get()?.scrollTo(cibleDArrivee, false, 'top top');

/**
 * Amène les ancres internes par le smoother ; renvoie de quoi s'en détacher quand le contexte est annulé.
 * La navigation native suit son cours (URL, `:target`, point de départ du focus) ; seul le défilement change de main.
 */
function suivreLesAncres(smoother: ScrollSmoother) {
	const wrapper = smoother.wrapper();
	// L'enveloppe est fixe : le navigateur y déroule une ancre ou un `scrollIntoView` au lieu du
	// document, puis le smoother la remet à zéro au hasard d'un rafraîchissement. On la remet à
	// zéro dès l'événement, avant l'affichage, et c'est le smoother qui amène la cible.
	const garderLEnveloppeImmobile = () => {
		if (wrapper.scrollTop) wrapper.scrollTop = 0;
	};
	const suivreLAncre = (evenement: MouseEvent) => {
		if (evenement.defaultPrevented || evenement.button !== 0) return;
		if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
		const lien = evenement.target instanceof Element ? evenement.target.closest('a') : null;
		if (!lien || lien.target || !estDansLaPage(lien)) return;
		const cible = cibleDeLAncre(lien.hash);
		if (cible) smoother.scrollTo(cible, true, 'top top');
	};
	wrapper.addEventListener('scroll', garderLEnveloppeImmobile);
	document.addEventListener('click', suivreLAncre);
	return () => {
		wrapper.removeEventListener('scroll', garderLEnveloppeImmobile);
		document.removeEventListener('click', suivreLAncre);
	};
}

function estDansLaPage(lien: HTMLAnchorElement) {
	return (
		lien.origin === location.origin &&
		lien.pathname === location.pathname &&
		lien.search === location.search
	);
}

function cibleDeLAncre(ancre: string) {
	return ancre.length > 1 ? document.getElementById(ancre.slice(1)) : null;
}
