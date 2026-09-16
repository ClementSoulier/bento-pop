/**
 * Les encres transparentes de l'app, et ce qu'elles valent en contraste.
 *
 * L'encre `#0a0a0a` posée à 55 % sur le jaune `#fbbf24` donne un rapport de
 * **3,84 : 1**, sous les 4,5 : 1 que le WCAG demande à un texte normal, et elle
 * habillait quatorze textes : le pseudo du composer, les intitulés de section du
 * profil, « Options », les suggestions de l'accueil, les libellés des crédits.
 * À 40 %, les onglets inactifs et le texte d'invite de « Trouver » tombaient à
 * **2,71**, et à 35 % le libellé d'une case vide à **2,32**. Relevé au chantier
 * 11, calculs §4.8.
 *
 * Deux encres suffisent, et elles vivent ici pour que le rapport se vérifie à un
 * seul endroit plutôt que dans dix-huit littéraux recopiés.
 */

/**
 * Texte secondaire : 65 % d'encre. 5,16 : 1 sur le jaune, 6,05 : 1 sur le
 * crème, 6,29 : 1 sur le blanc. C'est la seule qui se pose sur le jaune, où 60 %
 * ne donneraient que 4,45 : 1.
 */
export const INK_MUTED = 'rgba(10,10,10,0.65)';

/**
 * Texte d'invite, onglet inactif, libellé d'une case vide, flèches et chevrons :
 * 60 % d'encre, sur blanc ou sur crème seulement. 5,25 : 1 sur le blanc de la
 * barre d'onglets et des lignes de crédits, 5,02 : 1 sur le crème d'une case
 * vide.
 *
 * Les flèches « ↗ » et les chevrons « › » ne sont pas du texte à lire, mais ils
 * disent où mène la ligne : le WCAG leur demande 3 : 1, qu'ils n'avaient pas.
 */
export const INK_PLACEHOLDER = 'rgba(10,10,10,0.6)';
