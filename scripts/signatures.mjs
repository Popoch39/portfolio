// Relève la signature du code de chaque pièce : ses premières lignes de code, hors lignes vides et
// commentaires, lues au commit de l'anatomie (`AnatomyContent.sha`) → src/anatomies/<slug>/signatures.json.
// Le repère de la fiche les affiche au survol. Lancé à la main (`pnpm signatures`) quand un commit lu
// ou une plage de lignes change, pas au build : le build n'a pas besoin du réseau.
import { writeFileSync } from 'node:fs';
import { projects } from '../src/data/profile.ts';

/** Lignes d'une signature : assez pour reconnaître le code, peu pour tenir dans le repère. */
const LINES = 4;

/** Commentaire de ligne selon l'extension : `--` en Lua, `#` en shell, `//` et `/* … *\/` ailleurs. */
const commentOf = (path) => {
	if (path.endsWith('.lua')) return /^\s*--/;
	if (path.endsWith('.sh')) return /^\s*#/;
	return /^\s*(\/\/|\/\*|\*)/;
};

const sources = new Map();
async function source(repo, sha, path) {
	const url = `https://raw.githubusercontent.com/Popoch39/${repo}/${sha}/${path}`;
	if (!sources.has(url)) {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${url} : ${response.status}`);
		sources.set(url, (await response.text()).split('\n'));
	}
	return sources.get(url);
}

for (const project of projects) {
	const { anatomy } = await import(`../src/anatomies/${project.slug}/index.ts`);
	const { sha, pieces } = anatomy.content;
	const signatures = {};
	for (const { id, code } of pieces) {
		const lines = await source(project.repo, sha, code.path);
		const [first, last] = code.lines;
		const comment = commentOf(code.path);
		signatures[id] = lines
			.slice(first - 1, last)
			.map((text, i) => [first + i, text.trimEnd()])
			.filter(([, text]) => text.trim() && !comment.test(text))
			.slice(0, LINES);
	}
	// Une ligne de code par ligne du fichier : le diff d'un nouveau relevé se lit comme le code.
	const json = Object.entries(signatures)
		.map(([id, lines]) => `\t${JSON.stringify(id)}: [\n${lines.map((line) => `\t\t${JSON.stringify(line)}`).join(',\n')}\n\t]`)
		.join(',\n');
	const output = new URL(`../src/anatomies/${project.slug}/signatures.json`, import.meta.url);
	writeFileSync(output, `{\n${json}\n}\n`);
	console.log(`Signatures écrites : src/anatomies/${project.slug}/signatures.json`);
}
