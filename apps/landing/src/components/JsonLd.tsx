/**
 * Injecte un bloc `<script type="application/ld+json">` côté serveur.
 * `dangerouslySetInnerHTML` est sûr ici : le contenu est sérialisé via
 * `JSON.stringify`, qui échappe nativement les caractères dangereux pour
 * un contexte JSON, et on remplace `</` pour parer la sortie prématurée
 * du <script> dans le DOM (la seule séquence non échappée par stringify).
 */
export function JsonLd({ data }: { data: object | readonly object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
