/**
 * Largeurs des caractères d'Extenda, la police des titres de case, en unités
 * de sa grille : 2 048 par em.
 *
 * Tirées de `packages/brand/assets/fonts/extenda-100-yotta.otf`, tables `cmap`
 * et `hmtx` ; `apps/mobile/src/components/bento/extenda-metrics.test.ts` les
 * relit dans le fichier et échoue si la police change. N'y figurent que les
 * caractères qu'un titre en capitales peut afficher : latin, grec, cyrillique,
 * ponctuation et symboles monétaires. Les minuscules en sont absentes,
 * `textTransform: 'uppercase'` ne les rend jamais, et Extenda leur donne
 * d'autres largeurs.
 *
 * **Partagé depuis le chantier 13**, comme les largeurs de Bungee dans
 * `bento.ts` : l'app mesure ses titres avec, et l'aperçu de lien de la landing
 * y coupe la question d'une édition, en Extenda, la seule police qu'il
 * embarque. Aucune dépendance : données et fonction pures.
 */

export const EXTENDA_UNITS_PER_EM = 2048;

/**
 * Le plus large glyphe de la police, « ‰ », soit 1,47 em : la largeur prêtée
 * à un caractère qu'elle n'a pas, et qu'une police de secours dessine à sa
 * place.
 */
export const EXTENDA_WIDEST = 3018;

/** Largeur → caractères de cette largeur. */
const WIDTHS: Record<number, string> = {
  342: '΄',
  537: '‒',
  539: ' ',
  629: '¹',
  649: "'",
  654: ',',
  660: '‘’‚',
  676: '·',
  683: '`',
  684: '´',
  698: ':;',
  700: ';',
  704: '.․',
  720: '·',
  741: '¸',
  762: '!¡',
  769: 'ȷ',
  784: '¦',
  788: 'I|ÌÍÎÏĨĪĬĮİǏΊΙΪІЇӀḮỈỊ',
  797: '¨',
  800: '¯',
  810: '⁄',
  833: '‹',
  836: '›',
  850: '~',
  852: '[]',
  861: '1',
  862: ')',
  867: '(',
  878: '°•',
  885: '_',
  898: '-÷',
  902: '+',
  904: '±',
  942: 'Ј',
  944: '×',
  946: '²',
  956: 'JĴ',
  970: '{}',
  975: '*',
  984: 'º',
  987: 'ª',
  991: '³',
  995: '=',
  1027: '½',
  1030: '¼',
  1039: '΅',
  1060: '/',
  1066: '\\',
  1067: 'Ł',
  1073: 'ΓГ',
  1080: 'LĹĻЃḶ',
  1120: '†',
  1132: '‡',
  1139: 'Ŀ',
  1162: '<',
  1163: '>',
  1170: 'F₣',
  1174: 'Ґ',
  1175: 'EÈÉÊËĒĔĖĘĚȨΈΕЀЁЕẸẺẼẾỀỂỄỆ',
  1179: 'Ξ',
  1181: '7',
  1211: 'TŢŤŦṬ',
  1217: 'ȚΤТ',
  1236: 'Σ',
  1267: 'ZŹŻŽΖẒ',
  1276: '^',
  1294: '?',
  1298: '¬',
  1300: '£',
  1304: '₤',
  1305: '¿',
  1306: '"',
  1309: '“”',
  1312: '„',
  1336: '2',
  1392: '¢',
  1393: '3',
  1394: 'УӮ',
  1399: 'Ў',
  1402: '5',
  1404: '$Ә',
  1408: '4',
  1418: '§',
  1428: 'SŚŞŠȘЅṢ',
  1430: 'Ľ',
  1444: 'Ŝ',
  1456: '8',
  1468: '6',
  1469: '–',
  1477: '9',
  1486: 'PÞΡБР',
  1489: 'Ь',
  1492: 'RŔŖŘЯ',
  1501: '0',
  1508: 'BΒВḄ',
  1510: '»',
  1512: '«',
  1516: '€',
  1517: 'Ν',
  1518: 'ĸ₨',
  1521: 'NÑŃŅŇŊЍИЙӢṄṆ',
  1528: 'Һ',
  1531: 'Y¤¥ÝŶŸΎΥΫỲỴỶỸ',
  1532: '₧₽',
  1541: 'Ч',
  1542: 'HUÙÚÛÜĤŨŪŬŮŰŲǓǕǗǙǛΉΗНḤỤỦ',
  1543: 'Џ',
  1545: 'Λ',
  1546: 'Ħ',
  1549: 'AVÀÁÂÃÄÅĀĂĄǍǞǺΆΑΔАẠẢẤẦẨẪẬẮẰẲẴẶ',
  1556: 'DĎḌ',
  1568: '#',
  1570: 'Ĳ',
  1572: 'Ѵ',
  1576: 'ΠП',
  1585: 'X',
  1587: 'ẞ',
  1599: 'ÐĐ',
  1605: 'GKĜĞĠĢĶǦК',
  1606: 'З',
  1608: 'Ќ',
  1609: 'CÇĆĈĊČΘС',
  1610: 'OÒÓÔÕÖŌŎŐǑȪΌΟОṌṐṒỌỎỐỒỔỖỘ',
  1611: '&Q',
  1614: 'ØǾЄЭ',
  1627: 'ΚϏ',
  1631: 'ΧХ',
  1642: 'ƯỨỪỬỮỰ',
  1652: 'ΏΩ',
  1666: 'ƠỚỜỞỠỢ',
  1668: 'Л',
  1718: '¶',
  1721: 'Ц',
  1738: 'Ђ',
  1742: 'ΦФ',
  1745: 'Ћ',
  1771: 'Ъ',
  1775: '©®',
  1891: '—',
  1919: 'Д',
  1944: 'MΜМḾ',
  1961: 'Ψ',
  1998: 'Æ',
  2003: 'Œ',
  2031: 'Ǽ',
  2083: '@',
  2112: '…',
  2180: '™',
  2210: 'Ш',
  2213: '%',
  2239: 'Ы',
  2261: 'Њ',
  2285: 'WŴẀẂẄ',
  2354: 'Щ',
  2358: 'Љ',
  2362: 'Ю',
  2409: 'Ж',
  3018: '‰',
};

export const EXTENDA_ADVANCES: ReadonlyMap<string, number> = new Map(
  Object.entries(WIDTHS).flatMap(([width, chars]) =>
    [...chars].map((char) => [char, Number(width)] as const),
  ),
);

/**
 * Espaces insécables et traits d'union Unicode, absents d'Extenda : comptés
 * comme l'espace et le trait d'union, plutôt qu'au plus large glyphe, qui
 * gonflerait la mesure d'un caractère étroit.
 */
const ALIASES: Readonly<Record<string, string>> = {
  '\u00a0': ' ',
  '\u2007': ' ',
  '\u202f': ' ',
  '\u2010': '-',
  '\u2011': '-',
};

/**
 * Largeur d'un texte en Extenda, à la taille `fontSize`.
 *
 * Sans crénage, qui ne fait que resserrer : la table `kern` de la police n'a
 * que des paires négatives, 10 920. La mesure majore donc le rendu ; sur un
 * iPhone 17 Pro, « MEGALOVA » tenait dans 73,4 pt pour 74,7 mesurés ici.
 * L'espacement `letterSpacing` compte pour chaque caractère, dernier compris :
 * une majoration encore, quelle que soit la façon dont la plateforme le répartit.
 */
export function extendaTextWidth(text: string, fontSize: number, letterSpacing: number): number {
  let units = 0;
  let count = 0;
  for (const char of text) {
    units += EXTENDA_ADVANCES.get(ALIASES[char] ?? char) ?? EXTENDA_WIDEST;
    count += 1;
  }
  return (units / EXTENDA_UNITS_PER_EM) * fontSize + letterSpacing * count;
}
