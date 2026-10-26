# Kit du skill `anatomy`

Copié depuis le dossier `kit/` du skill : la palette du site surcharge ses tokens dans
`src/anatomies/palette.css`. Pour le mettre à jour, recopier les mêmes fichiers d'un bloc,
réappliquer le correctif ci-dessous et mettre à jour ce fichier.

**Seul correctif local** : `solidSvg` regroupe les faces d'un solide (ombres et dessus) dans un
`<g class="iso-faces">`, et les règles de `ISO_CSS` / `iso.css` qui visaient ces faces en enfants
directs du solide passent par ce groupe. Le grain de la pièce visée masque ainsi un groupe par
solide plutôt que chaque face : trois fois moins de masques redessinés à chaque image.

- **Source** : https://github.com/wheresryan22/anatomy (licence MIT, `LICENSE` à côté).
- **Version** : le skill n'a pas de numéro de version ; la copie correspond au commit
  `689dcf966e63d92be10a5d593c6e19e10acd4422` (12 octobre 2026), installé localement le même jour.
- **Fichiers** : le cœur typé (`iso-kit.ts`) et sa version ESM (`iso-kit.mjs`), les tours
  (`lathe.mjs`), les tubes (`tube.mjs`), l'audit (`audit.mjs`) et la CSS (`iso.css`, égale à
  `ISO_CSS`). `lathe.mjs`, `tube.mjs` et `audit.mjs` importent `./iso-kit.mjs` : garder le
  dossier plat et les deux copies du cœur.

Empreintes SHA-256, correctif compris, vérifiables avec `sha256sum -c` depuis ce dossier :

```
90c5bb4a86f108e8a1d3211dbea326bed16acd887c3438810ea29200a2cde28d  audit.mjs
ddb056057b56ab800816faeb2a22e7417263103a432f1f1bca531b694cd6be8f  iso-kit.mjs
26f29e4e819440cfaa57372ca3e186fecb7bddf054abd6400402ed9846538d62  iso-kit.ts
8d4c0642b0a0b76db662dceebeec888790bccf75a506f1993f9117ccd820cae4  iso.css
a4e7e974b1a37e603ad2b76363b6f9815cc101dfff0ad277a5d4e8f1dc56fccb  lathe.mjs
bcb3cc360f6d83e6a5753f4c464b4587ab7965028b05a5d58e285abce58667c9  tube.mjs
87c078ab9d90a3044f359e6b563d4e6afea7aa060897cf4f21618687b3856796  LICENSE
```
