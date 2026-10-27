// Lecture des polices (woff2 servis, sources TrueType) sans dépendance : seule la table `cmap`
// compte, c'est elle qui dit quels caractères une police dessine.
import { brotliDecompressSync } from 'node:zlib';

/** Les tables connues du format WOFF2, dans l'ordre de leur indice (spécification W3C, 5.1). */
const KNOWN_TAGS =
	'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'
		.match(/.{4}\s?/g)
		.map((tag) => tag.slice(0, 4));

/** Les tables d'un woff2 : un seul flux Brotli, tables bout à bout dans l'ordre du répertoire. */
function woff2Tables(buffer) {
	const numTables = buffer.readUInt16BE(12);
	const compressedLength = buffer.readUInt32BE(20);
	let at = 48;
	const base128 = () => {
		let value = 0;
		for (let i = 0; i < 5; i++) {
			const byte = buffer[at++];
			value = value * 128 + (byte & 0x7f);
			if (!(byte & 0x80)) return value;
		}
		throw new Error('woff2 : entier UIntBase128 trop long');
	};
	const entries = [];
	for (let i = 0; i < numTables; i++) {
		const flags = buffer[at++];
		const tag = (flags & 0x3f) === 0x3f ? buffer.toString('latin1', at, (at += 4)) : KNOWN_TAGS[flags & 0x3f];
		const length = base128();
		const version = flags >> 6;
		// glyf et loca sont transformés en version 0, les autres tables hors version 0.
		const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
		entries.push({ tag, length: transformed ? base128() : length });
	}
	const data = brotliDecompressSync(buffer.subarray(at, at + compressedLength));
	const tables = new Map();
	let offset = 0;
	for (const { tag, length } of entries) {
		tables.set(tag, data.subarray(offset, offset + length));
		offset += length;
	}
	return tables;
}

/** Les tables d'une police TrueType (sfnt) : répertoire de 16 octets par table. */
function sfntTables(buffer) {
	const tables = new Map();
	for (let i = 0, at = 12; i < buffer.readUInt16BE(4); i++, at += 16) {
		const offset = buffer.readUInt32BE(at + 8);
		tables.set(buffer.toString('latin1', at, at + 4), buffer.subarray(offset, offset + buffer.readUInt32BE(at + 12)));
	}
	return tables;
}

/** Les points de code d'une sous-table `cmap` au format 4 (BMP) ou 12 (Unicode complet). */
function codePointsOf(table) {
	const points = new Set();
	const format = table.readUInt16BE(0);
	if (format === 12) {
		for (let i = 0, at = 16; i < table.readUInt32BE(12); i++, at += 12) {
			for (let cp = table.readUInt32BE(at); cp <= table.readUInt32BE(at + 4); cp++) points.add(cp);
		}
	} else if (format === 4) {
		const segments = table.readUInt16BE(6) / 2;
		const ends = 14;
		const starts = ends + segments * 2 + 2;
		const deltas = starts + segments * 2;
		const ranges = deltas + segments * 2;
		for (let s = 0; s < segments; s++) {
			const [end, start] = [table.readUInt16BE(ends + s * 2), table.readUInt16BE(starts + s * 2)];
			const [delta, range] = [table.readUInt16BE(deltas + s * 2), table.readUInt16BE(ranges + s * 2)];
			for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
				const indexed = range === 0 ? cp : table.readUInt16BE(ranges + s * 2 + range + (cp - start) * 2);
				const glyph = range !== 0 && indexed === 0 ? 0 : (indexed + delta) & 0xffff;
				// Le glyphe 0 (.notdef) veut dire « pas de glyphe ».
				if (glyph !== 0) points.add(cp);
			}
		}
	} else {
		throw new Error(`cmap : format ${format} non lu`);
	}
	return points;
}

/** Les caractères qu'une police dessine (woff2 ou TrueType), d'après sa sous-table `cmap` Unicode la plus complète. */
export function cmap(buffer) {
	const tables = buffer.toString('latin1', 0, 4) === 'wOF2' ? woff2Tables(buffer) : sfntTables(buffer);
	const table = tables.get('cmap');
	if (!table) throw new Error('police sans table cmap');
	const records = Array.from({ length: table.readUInt16BE(2) }, (_, i) => ({
		platform: table.readUInt16BE(4 + i * 8),
		encoding: table.readUInt16BE(6 + i * 8),
		offset: table.readUInt32BE(8 + i * 8),
	}));
	// Windows Unicode complet (3, 10), sinon Windows BMP (3, 1), sinon Unicode (0, *).
	const record =
		records.find((r) => r.platform === 3 && r.encoding === 10) ?? records.find((r) => r.platform === 3 && r.encoding === 1) ?? records.find((r) => r.platform === 0);
	if (!record) throw new Error('cmap sans sous-table Unicode');
	return codePointsOf(table.subarray(record.offset));
}
