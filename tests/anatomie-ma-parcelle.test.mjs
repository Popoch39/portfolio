// Anatomie de ma-parcelle en anglais (#40) : la colonne de sondage parle la langue de la version, sur
// la fiche, dans l'aperçu de l'accueil et dans sa figure autonome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURE, readDist, readFiche, readHome, headOf, tags, attr, elements, text } from './helpers/dist.mjs';

const SLUG = 'ma-parcelle';
/** Le relevé au repos de la carte, tel que le build l'écrit. */
const releveOf = (html) => text(html.match(/data-releve[^>]*>([^<]*)</)?.[1] ?? '');
const anatomySection = (html, heading) => elements(html, 'section').find((s) => elements(s, 'h2').map(text).includes(heading)) ?? '';
/** Le titre de la carte, après « Fig. n ». */
const headingOf = (figure) => text(figure.match(/class="fig"[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]*)</)?.[1] ?? '');
const byClass =(fragment, name, cls) => elements(fragment, name).filter((el) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tags(el, name)[0]));

/**
 * Un texte français : un mot outil ou un mot de la colonne de sondage, ou une lettre accentuée. Le
 * nom du dépôt, `ma_parcelle`, n'en est pas un : le soulignement le soude en un seul mot.
 */
const FRENCH = /\b(?:le|la|les|des|du|une?|et|sans|pour|dans|qui|sur|chaque|strates?|parcelles?|requêtes?|sondage|carott\w*|forer)\b|[àâçéèêëîïôûùœ]/i;

/** Les textes de l'anatomie d'une fiche anglaise : ceux qui viennent de son module, pas du cadre de la fiche. */
function anatomyTexts(html) {
	const head = headOf(html);
	const section = anatomySection(html, 'Anatomy');
	const [figure] = elements(section, 'figure');
	const svg = tags(section, 'svg').find((t) => attr(t, 'role') === 'img') ?? '';
	return {
		title: text(elements(head, 'title')[0] ?? ''),
		description: attr(tags(head, 'meta').find((t) => attr(t, 'name') === 'description') ?? '', 'content'),
		lede: text(elements(elements(html, 'section')[0] ?? '', 'p')[0] ?? ''),
		heading: headingOf(figure),
		consignes: byClass(figure, 'span', 'consigne').map(text),
		caption: text(elements(section, 'figcaption')[0] ?? '').replace(/^Fig\. 1 — /, ''),
		label: attr(svg, 'aria-label'),
		pieces: elements(section, 'li')
			.filter((li) => /^item\b/.test(attr(tags(li, 'li')[0], 'class') ?? ''))
			.flatMap((li) => [text(byClass(li, 'span', 'name')[0] ?? ''), text((byClass(li, 'span', 'role')[0] ?? '').replace(/<a\b[\s\S]*<\/a>/, ''))]),
	};
}

test('en : la fiche relève la parcelle au repos en anglais', () => {
	assert.equal(releveOf(anatomySection(readFiche(SLUG, 'en'), 'Anatomy')), '33063 KJ 33 · ready · 0/6');
});

test('en : la fiche ne montre ni n’annonce aucun texte français de l’anatomie', () => {
	const texts = anatomyTexts(readFiche(SLUG, 'en'));
	for (const [field, value] of Object.entries(texts)) {
		for (const one of [value].flat()) {
			assert.ok(one, `${field} : texte absent`);
			assert.doesNotMatch(one, FRENCH, `${field} : « ${one} »`);
		}
	}
	assert.equal(texts.pieces.length, 14, 'sept pièces, chacune avec son nom et son rôle');
});

test('en : l’aperçu de l’accueil nomme la machine, la consigne et le relevé en anglais, et décrit son image', () => {
	const figure = elements(readHome('en'), 'figure').find((f) => tags(f, 'div').some((t) => attr(t, 'data-motion') === SLUG)) ?? '';
	assert.ok(figure, 'carte de l’aperçu absente');
	assert.equal(headingOf(figure), 'Coring rig');
	assert.equal(releveOf(figure), '33063 KJ 33 · ready · 0/6');
	const said = [text(figure), attr(tags(figure, 'img')[0] ?? '', 'alt') ?? ''];
	for (const one of said) assert.doesNotMatch(one, FRENCH, `« ${one} »`);
});

test('en : la figure autonome anglaise porte le libellé anglais, la française le sien', () => {
	const label = (locale) => attr(tags(readDist(FIGURE[locale](SLUG).slice(1)), 'svg')[0], 'aria-label') ?? '';
	assert.match(label('en'), /^Cutaway coring rig\. /);
	assert.doesNotMatch(label('en'), FRENCH);
	assert.match(label('fr'), /^Colonne de sondage en écorché\. /);
});
