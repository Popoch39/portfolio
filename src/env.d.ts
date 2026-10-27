/**
 * Les valeurs du build, injectées par `vite.define` (`src/lib/build-info.mjs`) : le commit court, `null`
 * hors d'un dépôt git ; la date du build, instant ISO ; la version de chaque dépendance demandée.
 */
declare const __BUILD__: {
	commit: string | null;
	date: string;
	versions: Record<string, string>;
};
