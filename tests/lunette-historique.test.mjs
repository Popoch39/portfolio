// L'historique de la Lunette aux flèches, comme la ligne de commande de Vim : ↑ dans une Lunette vide
// le remonte, ↓ redescend jusqu'à la ligne vide ; une fois la frappe commencée, les flèches déplacent la
// sélection. Le choix est pur, importé tel quel sous Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recall } from '../src/lunette/recall.ts';

/** Les commandes lancées, la plus récente en dernier. */
const history = ['e trekker', 'help', 'set lang=en'];
const up = 1;
const down = -1;

test('↑ dans une Lunette vide remonte l’historique, de la plus récente à la plus ancienne, et s’arrête à elle', () => {
	assert.deepEqual(recall(history, undefined, '', up), { line: 'set lang=en', at: 2 });
	assert.deepEqual(recall(history, 2, 'set lang=en', up), { line: 'help', at: 1 });
	assert.deepEqual(recall(history, 1, 'help', up), { line: 'e trekker', at: 0 });
	assert.deepEqual(recall(history, 0, 'e trekker', up), { line: 'e trekker', at: 0 });
});

test('↓ redescend vers les plus récentes, puis revient à la ligne vide', () => {
	assert.deepEqual(recall(history, 0, 'e trekker', down), { line: 'help', at: 1 });
	assert.deepEqual(recall(history, 1, 'help', down), { line: 'set lang=en', at: 2 });
	assert.deepEqual(recall(history, 2, 'set lang=en', down), { line: '' });
});

test('↓ dans une Lunette vide, sans ligne rappelée, déplace la sélection', () => {
	assert.equal(recall(history, undefined, '', down), undefined);
});

test('dès qu’on tape, ↑ et ↓ déplacent la sélection ; sans historique aussi', () => {
	assert.equal(recall(history, undefined, 'e t', up), undefined);
	assert.equal(recall(history, undefined, 'e t', down), undefined);
	assert.equal(recall([], undefined, '', up), undefined);
});
