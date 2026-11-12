/**
 * Animation base: the only entry point for GSAP on the site (ADR 0001).
 * Loaded by the layout on every page; the bundler turns it into a single chunk, cached across pages.
 */
import { gsap } from 'gsap';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
// Not at `DOMContentLoaded` nor at `load`: each of those refreshes measures every scene again, on a
// phone a long task of its own. The scenes are built once the page has settled, followed by a single
// refresh (`buildScenes`).
ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,resize' });

// Everything that moves lives in this context: nothing is created under `reduce`, and everything
// is reverted (inline styles included) as soon as the preference flips, without a reload.
// The pointer is a condition of the scenes too: the smoother changes their default scroller, so they
// are rebuilt when it comes or goes.
const CONDITIONS = {
	motionAllowed: '(prefers-reduced-motion: no-preference)',
	finePointer: '(pointer: fine)',
};
const motion = gsap.matchMedia();

const pageLoaded = new Promise((resolve) => {
	if (document.readyState === 'complete') resolve(undefined);
	else addEventListener('load', resolve, { once: true });
});
// Fonts and images have taken their place: scene thresholds and anchor positions will not move any more.
const pageSettled = Promise.all([document.fonts.ready, pageLoaded]);
let settled = false;
pageSettled.then(() => {
	settled = true;
});

// The opening (the Intro) keeps the main thread to itself while it moves: nobody can scroll to the
// other scenes meanwhile, and building them would cost it frames. They are built in its dead time,
// a moment when nothing it plays on the main thread moves, so that its end hands over a page ready
// to scroll; or at its end, when it never reached that moment.
let endOpening = () => {};
/** Resolved once the opening has ended (finished, skipped or reverted), or at once without one. */
export const openingEnded = new Promise<void>((resolve) => {
	endOpening = resolve;
});
// Only the home page's inline trigger sets this class, before the first paint: elsewhere, or when it
// decided against the Intro, no opening will register to end.
const root = document.documentElement;
if (!root.classList.contains('intro')) endOpening();
else {
	// The Voile's safety net (`IntroTrigger.astro`) also takes the class away from an Intro that never
	// started (its chunk failed, it threw as it started) and so will never call `end`: the opening is over all the same.
	const lifted = new MutationObserver(() => {
		if (root.classList.contains('intro')) return;
		lifted.disconnect();
		endOpening();
	});
	lifted.observe(root, { attributeFilter: ['class'] });
}

// Before fonts and images are in, the scenes would be measured in a layout still on the move: the
// dead time is let go, and the opening's end builds them.
const onOpeningIdle = () => {
	if (settled) setTimeout(buildScenes);
};

/** The scenes waiting to be built, in page order (the order their modules register them). */
const pendingScenes: gsap.ContextFunc[] = [];
let scenesBuilt = false;

motion.add(CONDITIONS, ({ conditions }) => {
	if (!conditions?.motionAllowed) return;
	// Page restored from the back/forward cache: the window may have changed while it was frozen.
	const onCacheRestore = (event: PageTransitionEvent) => {
		if (event.persisted) ScrollTrigger.refresh();
	};
	addEventListener('pageshow', onCacheRestore);
	// No smoother without a mouse or a trackpad, not even an idle one: it would make its wrapper the
	// scroller, and pins on it are transforms set by script a frame behind the compositor's scroll
	// (on iOS the section jumps and the fling dies). On the window, the browser holds them `fixed`.
	const releaseAnchors = conditions.finePointer ? followAnchors(createSmoother()) : undefined;
	return () => {
		removeEventListener('pageshow', onCacheRestore);
		releaseAnchors?.();
	};
});

function createSmoother() {
	return ScrollSmoother.create({
		wrapper: '#smooth-wrapper',
		content: '#smooth-content',
		smooth: 1.5,
		// A touchscreen on a computer with a mouse: native scrolling stays under the finger.
		smoothTouch: false,
		onFocusIn: bringFocusIntoView,
	});
}

// In a task of its own: the opening ends, or reaches its dead time, from one of its frames.
Promise.all([pageSettled, openingEnded]).then(() => setTimeout(buildScenes));

/**
 * Builds the waiting scenes once fonts and images have taken their place, in the opening's dead time
 * or at its end, whichever comes first; then measures them all with one refresh, top to bottom, in
 * their final layout. Only once: the end of an opening that has already reached its dead time builds nothing.
 * All in one task: a pinned scene queues a full refresh for the next frame, which the one here
 * cancels; split over several tasks, each pin would cost its own full refresh.
 */
function buildScenes() {
	if (scenesBuilt) return;
	for (const scene of pendingScenes) addScene(scene);
	scenesBuilt = true;
	ScrollTrigger.refresh();
	// Outside the context: the landing anchor only matters at load, a preference flip later on must not
	// bring the page back to it. Without a smoother (reduced motion, no fine pointer), the browser
	// handles it. After the refresh: the pins have changed where the anchor stands.
	const target = anchorTarget(location.hash);
	if (target) ScrollSmoother.get()?.scrollTo(target, false, atTopOfVisibleArea());
}

function addScene(scene: gsap.ContextFunc) {
	motion.add(CONDITIONS, (context, contextSafe) => (context.conditions?.motionAllowed ? scene(context, contextSafe) : undefined));
}

/**
 * Registers a scene: its code only runs when motion is allowed, and everything it creates (tweens,
 * ScrollTriggers, inline styles) is reverted then recreated when the preference flips. It is built
 * once the page has settled and the opening has ended, never during the load.
 * HTML/CSS render the final state: the scene animates towards it (`from()` / `fromTo()`).
 */
export function registerScene(scene: gsap.ContextFunc) {
	if (scenesBuilt) addScene(scene);
	else pendingScenes.push(scene);
}

/**
 * Registers a detail: the page's answer to a gesture (a press, a key). Unlike a scene, it is set up at
 * once and whatever the preference: it only listens, and the visitor gets an answer under reduced motion
 * too, where its styles give it in one step. What it returns undoes it with the context.
 */
export function registerDetail(detail: gsap.ContextFunc) {
	// A context whose conditions all fail runs nothing: an always-true query keeps this one up when motion
	// is reduced under a finger. Not under GSAP's own `all` key, which it never records as matched: the
	// first media change anywhere in the page (a phone turned) would then revert and rebuild every detail,
	// a form open on screen along with what was typed in it.
	motion.add({ ...CONDITIONS, always: 'all' }, detail);
}

/**
 * Registers the opening (the Intro): built at once, unlike the other scenes, which wait for it. While
 * it plays, it calls `idle` at its dead time, when nothing it plays on the main thread moves for a
 * while (the scenes are built there), and `end` once it has ended (finished, skipped or reverted);
 * when it does not play (no cleanup returned, or motion reduced), it ends straight away.
 */
export function registerOpening(scene: (end: () => void, idle: () => void) => (() => void) | undefined) {
	motion.add(CONDITIONS, ({ conditions }) => {
		const cleanup = conditions?.motionAllowed ? scene(endOpening, onOpeningIdle) : undefined;
		if (!cleanup) endOpening();
		return cleanup;
	});
}

/**
 * Seconds a scrubbed scene takes to catch up with the scroll. Locked to it (`scrub: true`), a fast flick
 * of the wheel or a long fling plays a whole pinned scene in a blink; with a lag, its steps still show.
 * Under a finger there is no smoother: this lag is the only damping the scenes get.
 */
export const SCENE_SCRUB = 1;

// Scenes take GSAP from here, never on their own: a single instance, plugins already registered.
export { gsap, ScrollSmoother, ScrollTrigger };

/**
 * Has GSAP read the transform of every target a scene moves, all at once, in a single style pass. GSAP
 * reads a target's transform the first time it tweens it: left to the tweens, each target would be read
 * between two writes, at a layout each. A scene calls it before it writes anything.
 */
export function readTransforms(targets: Iterable<Element | null>) {
	for (const target of targets) if (target) gsap.getProperty(target, 'x');
}

/**
 * The mockups' CSS easing curves, kept as they are: GSAP only knows them through CustomEase, a plugin
 * the animation base does not load for a few curves.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
	const along = (p1: number, p2: number, t: number) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
	return (progress: number) => {
		// The x curve rises from 0 to 1 when x1 and x2 lie in [0, 1]: a bisection always finds t.
		let low = 0;
		let high = 1;
		for (let step = 0; step < 20; step++) {
			const middle = (low + high) / 2;
			if (along(x1, x2, middle) < progress) low = middle;
			else high = middle;
		}
		return along(y1, y2, (low + high) / 2);
	};
}

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
