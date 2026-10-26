// Audit géométrique du tableau d'annonciateur avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/claude-tmux-notify/audit.mjs --audit
// En `.mjs` : l'enregistreur du kit est inféré depuis son JS, ses méthodes ne se typent pas.
// Il contrôle la pose au repos, puis la pose de démonstration (volets 3 et 5 tombés, fiche dans le
// jack de 2:api-server, boucle pleine) avec l'ordre de peinture réglé au repos : le mouvement ne
// réordonne pas la figure, cet ordre doit donc tenir dans les deux.
import { A, record } from './order.mjs';
import { scene } from './geometry.ts';
import { projection as P } from './layout.ts';

// La feuillure est une plaque mince et profonde (2 × 17) que l'audit prend pour une tige de rayon
// 8,5 : vu à 4×, le peigne court sur la façade du meneau, à plus de 2 px de toute arête visible
// de la feuillure.
const CROWD_OK = [['peigne-*', 'feuillure-gauche']];

const rest = scene();
const R = record(P, rest);
A.settle(R, P);
const keys = new Map(R.items.map((item) => [item.name, item.key]));
console.log('— au repos');
A.auditOrExit(R, P, { crowd: CROWD_OK });

const pose = scene({ fallen: [2, 4], plug: 1, bytes: 400 });
const shown = record(P, { ...pose, draws: pose.draws.map((draw) => ({ ...draw, key: keys.get(draw.name) })) });
console.log('— volets tombés, fiche dans le jack de 2:api-server, boucle pleine');
A.auditOrExit(shown, P, { crowd: CROWD_OK });
