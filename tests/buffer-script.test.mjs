// Le script du Buffer dans la sortie du build (#120) : comme la Lunette (ADR 0007), un morceau à part,
// importé au premier focus par le module de l'accueil. Ni lui, ni sa table bilingue ne partent avec la page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attr, moduleGraph, readHome, tags } from './helpers/dist.mjs';

/** Les morceaux qu'un code importe à la demande (`import("./y.js")`), en chemins servis. */
const onDemand = (code) => [...code.matchAll(/import\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g)].map((m) => `/_astro/${m[1]}`);

for (const locale of ['fr', 'en']) {
	const html = readHome(locale);
	const [script] = tags(html, 'script').filter((t) => attr(t, 'type') === 'module');
	const graph = moduleGraph(attr(script ?? '', 'src') ?? '');
	const chunks = onDemand(graph.code).filter((path) => /\/buffer\.[\w-]+\.js$/.test(path));

	test(`${locale} : l’accueil importe le Buffer à la demande, sans le charger ni le précharger`, () => {
		assert.equal(chunks.length, 1, 'le Buffer n’est pas importé à la demande par le module de l’accueil');
		const [chunk] = chunks;
		assert.ok(!graph.paths.includes(chunk), `${chunk} est dans le graphe chargé à l’ouverture`);
		assert.ok(!html.includes(chunk.slice(1)), `${chunk} est référencé par la page`);
		// La table bilingue est dans le morceau, pas dans le module de la page.
		assert.doesNotMatch(graph.code, /E492: pas une commande/);
	});

	test(`${locale} : le Buffer porte ses deux langues, sans la table ui du site`, () => {
		const code = chunks.map((chunk) => moduleGraph(chunk).code).join('\n');
		assert.match(code, /E1: type manquant — projet, app ou bonjour \?/);
		assert.match(code, /E1: missing type — project, app or hello\?/);
		// Un texte de la table `ui` qui ne sert qu'au build : il ne doit pas partir avec le Buffer.
		assert.doesNotMatch(code, /Ouvert au remote/);
	});
}
