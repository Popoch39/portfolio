# Sources des polices

Les fichiers variables d'Archivo et le fichier de Fragment Mono, copiés tels quels depuis le dépôt
google/fonts. Le site ne les sert jamais : `pnpm polices` les réduit aux caractères du build et
écrit les woff2 servis dans `src/fonts/` (ADR 0005). Pour les mettre à jour, recopier les mêmes
fichiers d'un commit plus récent, mettre à jour ce fichier, puis lancer `pnpm build && pnpm polices`.

- **Source** : https://github.com/google/fonts, dossiers `ofl/archivo/` et `ofl/fragmentmono/`
  (SIL Open Font License 1.1, `OFL-Archivo.txt` et `OFL-FragmentMono.txt` à côté).
- **Version** : commit `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0` (27 octobre 2026). Dernier
  changement des fichiers : `95f4904fc8bcf26d3420fe315560c96417c6dec7` (3 mars 2026) pour Archivo,
  `8f6cd0c1cdf938a8a31e246d8a9ba09b5f6cc830` (21 mai 2026) pour Fragment Mono.
- **Amont** : Archivo vient de https://github.com/Omnibus-Type/Archivo (commit
  `b5d63988ce19d044d3e10362de730af00526b672`, dossier `fonts/variable/`), Fragment Mono de
  https://github.com/weiweihuanghuang/fragment-mono (commit `3ff027831f9a8b5820b35e251e5914d5a3f5fac4`).
- **Fichiers** : la romaine `Archivo[wdth,wght].ttf` et l'italique `Archivo-Italic[wdth,wght].ttf`
  (axes `wdth` 62–125 et `wght` 100–900), `FragmentMono-Regular.ttf` (sans axe). Chaque licence est
  le `OFL.txt` du dossier de sa famille, renommé. google/fonts ne publie pas de woff2.

Empreintes SHA-256, vérifiables avec `sha256sum -c` depuis ce dossier :

```
0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053  Archivo[wdth,wght].ttf
305d13b4eb80e62f7d517f78d7c045250d977552a420f2dbed906f314e761305  Archivo-Italic[wdth,wght].ttf
0fe011f425873c2e0fc73a189e394e340ad48d2b9a99a576bdeec75cee000460  FragmentMono-Regular.ttf
108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b  OFL-Archivo.txt
ef14426248ca0404eae1ae65e61802b1627b5ec33aab117fb36edf401a81636e  OFL-FragmentMono.txt
```
