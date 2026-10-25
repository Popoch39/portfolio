# Kit du skill `anatomy`

Copié tel quel depuis le dossier `kit/` du skill, et jamais modifié ici : la palette du site
surcharge ses tokens dans `src/anatomies/palette.css`. Pour le mettre à jour, recopier les
mêmes fichiers d'un bloc et mettre à jour ce fichier.

- **Source** : https://github.com/wheresryan22/anatomy (licence MIT, `LICENSE` à côté).
- **Version** : le skill n'a pas de numéro de version ; la copie correspond au commit
  `689dcf966e63d92be10a5d593c6e19e10acd4422` (12 octobre 2026), installé localement le même jour.
- **Fichiers** : le cœur typé (`iso-kit.ts`) et sa version ESM (`iso-kit.mjs`), les tours
  (`lathe.mjs`), les tubes (`tube.mjs`), l'audit (`audit.mjs`) et la CSS (`iso.css`, égale à
  `ISO_CSS`). `lathe.mjs`, `tube.mjs` et `audit.mjs` importent `./iso-kit.mjs` : garder le
  dossier plat et les deux copies du cœur.

Empreintes SHA-256, vérifiables avec `sha256sum -c` depuis ce dossier :

```
90c5bb4a86f108e8a1d3211dbea326bed16acd887c3438810ea29200a2cde28d  audit.mjs
6d3ecc725d30c3b0346da309cf61dfa5a65017c23620bbd4093009d4fb104018  iso-kit.mjs
e9fc988c61a11bfac1f097e62419915ea86b2130ab091f1b50c0e019c907e253  iso-kit.ts
ef19bac5a42ba9be42b56b2c1cf7fc7e21d332a8060765e9ca1d987b8ab23924  iso.css
a4e7e974b1a37e603ad2b76363b6f9815cc101dfff0ad277a5d4e8f1dc56fccb  lathe.mjs
bcb3cc360f6d83e6a5753f4c464b4587ab7965028b05a5d58e285abce58667c9  tube.mjs
87c078ab9d90a3044f359e6b563d4e6afea7aa060897cf4f21618687b3856796  LICENSE
```
