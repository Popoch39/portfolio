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

// Polices et images ont pris leur place : seuils des scènes et positions des ancres ne bougeront plus.
const pageEnPlace = Promise.all([
	document.fonts.ready,
	new Promise((resoudre) => {
		if (document.readyState === 'complete') resoudre(undefined);
		else addEventListener('load', resoudre, { once: true });
	}),
]);

mouvement.add(MOUVEMENT_AUTORISE, () => {
	const smoother = ScrollSmoother.create({
		wrapper: '#smooth-wrapper',
		content: '#smooth-content',
		smooth: 1,
		// Au doigt, le défilement natif reste sous le doigt : un lissage y ferait traîner la page.
		smoothTouch: false,
		onFocusIn: amenerLeFocus,
	});
	// ScrollTrigger se recale seul au `load`, mais pas quand une police web arrive plus tard.
	pageEnPlace.then(() => ScrollTrigger.refresh());
	// Page restaurée depuis le cache avant/arrière : la fenêtre a pu changer pendant qu'elle était gelée.
	const auRetourDuCache = (evenement: PageTransitionEvent) => {
		if (evenement.persisted) ScrollTrigger.refresh();
	};
	addEventListener('pageshow', auRetourDuCache);
	const lacherLesAncres = suivreLesAncres(smoother);
	return () => {
		removeEventListener('pageshow', auRetourDuCache);
		lacherLesAncres();
	};
});

// Hors du contexte : l'ancre d'arrivée ne vaut qu'au chargement, une bascule de préférence
// plus tard ne doit pas y ramener. Sans smoother (mouvement réduit), le navigateur s'en charge.
// Attachée après le recalage du contexte sur la même promesse, elle passe après lui.
pageEnPlace.then(() => {
	const cible = cibleDeLAncre(location.hash);
	if (cible) ScrollSmoother.get()?.scrollTo(cible, false, sousLEntete());
});

/**
 * Enregistre une scène : son code ne s'exécute que si le mouvement est autorisé, et tout ce
 * qu'elle crée (tweens, ScrollTriggers, styles inline) est annulé puis recréé quand la préférence bascule.
 * Le HTML/CSS rend l'état final : la scène anime vers lui (`from()` / `fromTo()`).
 */
export function enregistrerScene(scene: gsap.ContextFunc) {
	mouvement.add(MOUVEMENT_AUTORISE, scene);
}

// Les scènes prennent GSAP ici, jamais à part : une seule instance, plugins déjà enregistrés.
export { gsap };

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
	// Toute ancre qui change (lien, historique, script) passe par `hashchange`. Chromium a déjà
	// déroulé l'enveloppe à ce moment-là : la cible serait mesurée depuis la mauvaise position.
	const suivreLeFragment = () => {
		garderLEnveloppeImmobile();
		const cible = cibleDeLAncre(location.hash);
		if (cible) smoother.scrollTo(cible, true, sousLEntete());
	};
	// Un lien vers l'ancre déjà dans l'URL ne déclenche pas `hashchange` : le clic s'en charge.
	const suivreLeLienVersLAncreCourante = (evenement: MouseEvent) => {
		if (evenement.defaultPrevented || evenement.button !== 0) return;
		if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
		const lien = evenement.target instanceof Element ? evenement.target.closest('a') : null;
		if (!lien || lien.target || !estDansLaPage(lien) || lien.hash !== location.hash) return;
		const cible = cibleDeLAncre(lien.hash);
		if (cible) smoother.scrollTo(cible, true, sousLEntete());
	};
	wrapper.addEventListener('scroll', garderLEnveloppeImmobile);
	addEventListener('hashchange', suivreLeFragment);
	document.addEventListener('click', suivreLeLienVersLAncreCourante);
	return () => {
		wrapper.removeEventListener('scroll', garderLEnveloppeImmobile);
		removeEventListener('hashchange', suivreLeFragment);
		document.removeEventListener('click', suivreLeLienVersLAncreCourante);
	};
}

let dernierElementFocalise: Element | null = null;

/**
 * Remplace le recentrage du smoother, qui laisse sous le header un élément « dans la vue » :
 * comme le navigateur sans lissage, l'élément focalisé n'est déplacé que s'il dépasse de la zone
 * visible, header déduit. Le même élément qui reprend le focus (retour sur l'onglet) ne fait pas sauter la page.
 */
function amenerLeFocus(smoother: ScrollSmoother, evenement: Event) {
	const element = evenement.target;
	if (!(element instanceof Element) || element === dernierElementFocalise) return false;
	dernierElementFocalise = element;
	if (!smoother.content().contains(element)) return false;
	const { top, bottom } = element.getBoundingClientRect();
	if (top < hauteurDeLEntete()) smoother.scrollTo(element, false, sousLEntete());
	else if (bottom > innerHeight) smoother.scrollTo(element, false, 'bottom bottom');
	return false;
}

/** La zone que couvre le header fixe, déclarée une fois en CSS (`scroll-padding-top`) pour le navigateur et pour le smoother. */
function hauteurDeLEntete() {
	return Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}

function sousLEntete() {
	return `top ${hauteurDeLEntete()}px`;
}

function estDansLaPage(lien: HTMLAnchorElement) {
	return (
		lien.origin === location.origin &&
		lien.pathname === location.pathname &&
		lien.search === location.search
	);
}

function cibleDeLAncre(ancre: string) {
	const fragment = ancre.slice(1);
	if (!fragment) return null;
	// Comme le navigateur : l'id tel quel, puis décodé (`#été` arrive en `#%C3%A9t%C3%A9`).
	return document.getElementById(fragment) ?? document.getElementById(decoder(fragment));
}

function decoder(fragment: string) {
	try {
		return decodeURIComponent(fragment);
	} catch {
		// Séquence `%` invalide : il n'existe pas de forme décodée, seul l'id tel quel peut correspondre.
		return fragment;
	}
}
