// Coloration de la signature d'une pièce, au build : une lecture à la tree-sitter réduite à ce que
// contiennent les signatures des six dépôts (TypeScript, Rust, Lua, shell) : mots-clés, fonctions,
// chaînes (interpolations de gabarit comprises), nombres et constantes, types, ponctuation.
import type { Signature } from './contract.ts';

export type TokenKind = 'kw' | 'fn' | 'str' | 'num' | 'type' | 'id' | 'pun' | 'com';

export interface Token {
	text: string;
	kind: TokenKind;
}

interface Grammar {
	keywords: Set<string>;
	literals: Set<string>;
	types: Set<string>;
	comment: string;
	/** Commentaire de bloc `/* … *\/`. */
	block: boolean;
	/** Gabarits `…${…}…` de JavaScript. */
	templates: boolean;
	/** Un mot suivi de `:` est une clé (`type: "command"`), pas un mot-clé ni un type. */
	keys: boolean;
}

const words = (list: string) => new Set(list.split(' '));

const TYPESCRIPT: Grammar = {
	keywords: words(
		'abstract as async await break case catch class const continue declare default do else enum export extends finally for from function if implements import in instanceof interface keyof let new of private protected public readonly return satisfies static switch throw try type typeof void while yield',
	),
	literals: words('true false null undefined this'),
	types: words('number string boolean unknown never any void object bigint'),
	comment: '//',
	block: true,
	templates: true,
	keys: true,
};

const GRAMMARS: Record<string, Grammar> = {
	ts: TYPESCRIPT,
	tsx: TYPESCRIPT,
	js: TYPESCRIPT,
	rs: {
		keywords: words(
			'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return static struct super trait type unsafe use where while',
		),
		literals: words('true false self'),
		types: words('u8 u16 u32 u64 usize i8 i16 i32 i64 isize f32 f64 bool char str Self'),
		comment: '//',
		block: true,
		templates: false,
		keys: false,
	},
	lua: {
		keywords: words('and break do else elseif end for function goto if in local not or repeat return then until while'),
		literals: words('true false nil'),
		types: new Set(),
		comment: '--',
		block: false,
		templates: false,
		keys: false,
	},
	sh: {
		keywords: words('if then else elif fi for while until do done case esac in function return local export'),
		literals: new Set(),
		types: new Set(),
		comment: '#',
		block: false,
		templates: false,
		keys: false,
	},
};

const PUNCTUATION = /[=+\-*/%!<>&|?:.,;(){}[\]@$#~^]/;

export function grammarOf(path: string): Grammar {
	const grammar = GRAMMARS[path.split('.').pop() ?? ''];
	if (!grammar) throw new Error(`Signature : aucune coloration pour « ${path} »`);
	return grammar;
}

export function tokenize(source: string, grammar: Grammar): Token[] {
	const out: Token[] = [];
	const push = (text: string, kind: TokenKind) => {
		if (!text) return;
		const last = out[out.length - 1];
		if (last?.kind === kind) last.text += text;
		else out.push({ text, kind });
	};
	let i = 0;
	while (i < source.length) {
		const rest = source.slice(i);
		const ch = source[i];
		// En shell, `${#tableau}` n'ouvre pas de commentaire : seul un `#` en début de mot le fait.
		if (rest.startsWith(grammar.comment) && (grammar.comment !== '#' || i === 0 || /\s/.test(source[i - 1]))) {
			push(rest, 'com');
			break;
		}
		if (grammar.block && rest.startsWith('/*')) {
			const end = source.indexOf('*/', i + 2);
			const stop = end < 0 ? source.length : end + 2;
			push(source.slice(i, stop), 'com');
			i = stop;
			continue;
		}
		// En Rust, `'a` est une durée de vie, pas un caractère.
		if (ch === "'" && grammar === GRAMMARS.rs && source[i + 2] !== "'" && source[i + 3] !== "'") {
			const lifetime = /^'[A-Za-z_]\w*/.exec(rest);
			if (lifetime) {
				push(lifetime[0], 'type');
				i += lifetime[0].length;
				continue;
			}
		}
		if (ch === '"' || ch === "'") {
			let j = i + 1;
			while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
			push(source.slice(i, j + 1), 'str');
			i = j + 1;
			continue;
		}
		if (ch === '`' && grammar.templates) {
			let j = i + 1;
			let text = '`';
			while (j < source.length && source[j] !== '`') {
				if (source[j] === '$' && source[j + 1] === '{') {
					push(text, 'str');
					text = '';
					let depth = 1;
					let k = j + 2;
					while (k < source.length && depth) {
						if (source[k] === '{') depth++;
						else if (source[k] === '}') depth--;
						if (depth) k++;
					}
					push('${', 'pun');
					for (const token of tokenize(source.slice(j + 2, k), grammar)) push(token.text, token.kind);
					push('}', 'pun');
					j = k + 1;
					continue;
				}
				text += source[j];
				j++;
			}
			push(source[j] === '`' ? `${text}\`` : text, 'str');
			i = j + 1;
			continue;
		}
		const word = /^[A-Za-z_][\w]*/.exec(rest);
		if (word) {
			const w = word[0];
			const after = source.slice(i + w.length).trimStart()[0];
			const before = source.slice(0, i).trimEnd().slice(-1);
			const key = grammar.keys && after === ':' && !source.slice(i + w.length).trimStart().startsWith('::');
			let kind: TokenKind = 'id';
			// Une clé, ou un membre après un point (`.catch(`), n'est jamais un mot-clé.
			if (key) kind = 'id';
			else if (grammar.keywords.has(w) && before !== '.') kind = 'kw';
			else if (grammar.literals.has(w)) kind = 'num';
			else if (grammar.types.has(w)) kind = 'type';
			else if (after === '(' || (after === '!' && grammar === GRAMMARS.rs)) kind = 'fn';
			else if (/^[A-Z][A-Z0-9_]+$/.test(w) && after !== '.') kind = 'num';
			else if (before !== '.' && /^[A-Z]/.test(w)) kind = 'type';
			push(w, kind);
			i += w.length;
			continue;
		}
		const number = /^\d[\d_.]*/.exec(rest);
		if (number) {
			push(number[0], 'num');
			i += number[0].length;
			continue;
		}
		push(ch, PUNCTUATION.test(ch) ? 'pun' : 'id');
		i++;
	}
	return out;
}

export interface SignatureLine {
	line: number;
	tokens: Token[];
}

/**
 * Les lignes de la signature, colorées et ramenées à gauche : l'indentation commune retirée, les
 * tabulations à deux espaces.
 */
export function signatureLines(signature: Signature, path: string): SignatureLine[] {
	const grammar = grammarOf(path);
	const texts = signature.map(([, text]) => text.replace(/\t/g, '  '));
	const indent = Math.min(...texts.map((text) => text.length - text.trimStart().length));
	return signature.map(([line], i) => ({ line, tokens: tokenize(texts[i].slice(indent), grammar) }));
}
