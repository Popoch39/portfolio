// Audit géométrique de la rampe à cadran avec l'audit du kit, sous Node (TypeScript natif) :
//   node src/anatomies/claude-status-line/audit.mjs --audit
import * as A from '../../vendor/anatomy/audit.mjs';
import { build } from './geometry.ts';
import { projection as P } from './layout.ts';
import { settled } from './order.mjs';

const { items, routes } = build();
const { R } = settled(items, routes, P);
A.auditOrExit(R, P);
