/**
 * Animation base: the only entry point for GSAP on the site (ADR 0001).
 * Loaded by the layout on every page; the bundler turns it into a single chunk, cached across pages.
 */
import { gsap } from 'gsap';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// Everything that moves lives in this context: nothing is created under `reduce`, and everything
// is reverted (inline styles included) as soon as the preference flips, without a reload.
const MOTION_ALLOWED = '(prefers-reduced-motion: no-preference)';
const motion = gsap.matchMedia();

// Fonts and images have taken their place: scene thresholds and anchor positions will not move any more.
const pageSettled = Promise.all([
	document.fonts.ready,
	new Promise((resolve) => {
		if (document.readyState === 'complete') resolve(undefined);
		else addEventListener('load', resolve, { once: true });
	}),
]);

motion.add(MOTION_ALLOWED, () => {
	const smoother = ScrollSmoother.create({
		wrapper: '#smooth-wrapper',
		content: '#smooth-content',
		smooth: 1,
		// Under a finger, native scrolling stays under the finger: smoothing would make the page lag.
		smoothTouch: false,
		onFocusIn: bringFocusIntoView,
	});
	// Without smoothing (under a finger), the browser scrolls the page itself, off the main thread on
	// a phone: a pin held by a transform written each frame trails behind it, the section scrolling
	// past its place then jumping back. Fixed, it is held by the browser.
	ScrollTrigger.defaults({ pinType: smoother.smooth() ? 'transform' : 'fixed' });
	// ScrollTrigger refreshes on its own at `load`, but not when a web font arrives later.
	pageSettled.then(() => ScrollTrigger.refresh());
	// Page restored from the back/forward cache: the window may have changed while it was frozen.
	const onCacheRestore = (event: PageTransitionEvent) => {
		if (event.persisted) ScrollTrigger.refresh();
	};
	addEventListener('pageshow', onCacheRestore);
	const releaseAnchors = followAnchors(smoother);
	return () => {
		removeEventListener('pageshow', onCacheRestore);
		releaseAnchors();
	};
});

// Outside the context: the landing anchor only matters at load, a preference flip later on must
// not bring the page back to it. Without a smoother (reduced motion), the browser handles it.
// Attached after the context's refresh on the same promise, it runs after it.
pageSettled.then(() => {
	const target = anchorTarget(location.hash);
	if (target) ScrollSmoother.get()?.scrollTo(target, false, atTopOfVisibleArea());
});

/**
 * Registers a scene: its code only runs when motion is allowed, and everything it creates (tweens,
 * ScrollTriggers, inline styles) is reverted then recreated when the preference flips.
 * HTML/CSS render the final state: the scene animates towards it (`from()` / `fromTo()`).
 */
export function registerScene(scene: gsap.ContextFunc) {
	motion.add(MOTION_ALLOWED, scene);
}

// Scenes take GSAP from here, never on their own: a single instance, plugins already registered.
export { gsap, ScrollSmoother, ScrollTrigger };

/**
 * Brings in-page anchors through the smoother; returns a way to detach when the context is reverted.
 * Native navigation carries on (URL, `:target`, focus starting point); only the scrolling changes hands.
 */
function followAnchors(smoother: ScrollSmoother) {
	const wrapper = smoother.wrapper();
	// The wrapper is fixed: the browser scrolls an anchor or a `scrollIntoView` inside it instead of
	// the document, then the smoother resets it whenever it happens to refresh. We reset it right at
	// the event, before painting, and the smoother brings the target.
	const keepWrapperStill = () => {
		if (wrapper.scrollTop) wrapper.scrollTop = 0;
	};
	// Every anchor change (link, history, script) goes through `hashchange`. Chromium has already
	// scrolled the wrapper by then: the target would be measured from the wrong position.
	const followFragment = () => {
		keepWrapperStill();
		const target = anchorTarget(location.hash);
		if (target) smoother.scrollTo(target, true, atTopOfVisibleArea());
	};
	// A link to the anchor already in the URL does not fire `hashchange`: the click takes care of it.
	const followLinkToCurrentAnchor = (event: MouseEvent) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target instanceof Element ? event.target.closest('a') : null;
		if (!link || link.target || !isOnThisPage(link) || link.hash !== location.hash) return;
		const target = anchorTarget(link.hash);
		if (target) smoother.scrollTo(target, true, atTopOfVisibleArea());
	};
	wrapper.addEventListener('scroll', keepWrapperStill);
	addEventListener('hashchange', followFragment);
	document.addEventListener('click', followLinkToCurrentAnchor);
	return () => {
		wrapper.removeEventListener('scroll', keepWrapperStill);
		removeEventListener('hashchange', followFragment);
		document.removeEventListener('click', followLinkToCurrentAnchor);
	};
}

let lastFocusedElement: Element | null = null;

/**
 * Replaces the smoother's re-centring, which leaves an element "in view" under a fixed bar: as the
 * browser does without smoothing, the focused element only moves if it sticks out of the visible
 * area, fixed bars excluded. The same element taking focus back (returning to the tab) does not make the page jump.
 */
function bringFocusIntoView(smoother: ScrollSmoother, event: Event) {
	const element = event.target;
	if (!(element instanceof Element) || element === lastFocusedElement) return false;
	lastFocusedElement = element;
	if (!smoother.content().contains(element)) return false;
	const { top, bottom } = element.getBoundingClientRect();
	const { top: areaTop, bottom: areaBottom } = visibleArea();
	if (top < areaTop) smoother.scrollTo(element, false, atTopOfVisibleArea());
	else if (bottom > areaBottom) smoother.scrollTo(element, false, `bottom ${areaBottom}px`);
	return false;
}

/**
 * The part of the window that no fixed bar covers, declared once in CSS (`scroll-padding` on
 * `:root`) for the browser and for the smoother.
 */
function visibleArea() {
	const style = getComputedStyle(document.documentElement);
	return {
		top: Number.parseFloat(style.scrollPaddingTop) || 0,
		bottom: innerHeight - (Number.parseFloat(style.scrollPaddingBottom) || 0),
	};
}

function atTopOfVisibleArea() {
	return `top ${visibleArea().top}px`;
}

function isOnThisPage(link: HTMLAnchorElement) {
	return (
		link.origin === location.origin &&
		link.pathname === location.pathname &&
		link.search === location.search
	);
}

function anchorTarget(hash: string) {
	const fragment = hash.slice(1);
	if (!fragment) return null;
	// Like the browser: the id as is, then decoded (`#été` arrives as `#%C3%A9t%C3%A9`).
	return document.getElementById(fragment) ?? document.getElementById(decode(fragment));
}

function decode(fragment: string) {
	try {
		return decodeURIComponent(fragment);
	} catch {
		// Invalid `%` sequence: there is no decoded form, only the raw id can match.
		return fragment;
	}
}
