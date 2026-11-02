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
	ScrollSmoother.create({
		wrapper: '#smooth-wrapper',
		content: '#smooth-content',
		smooth: 1,
		// Au doigt, le défilement natif reste sous le doigt : un lissage y ferait traîner la page.
		smoothTouch: false,
	});
});
