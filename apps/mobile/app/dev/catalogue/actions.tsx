import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import { BrandGround, Button, Chip, IconButton } from '@/design';

/**
 * Le catalogue, page des actions (chantier 30, lot 3) : chaque composant dans
 * les états de son aperçu, aux mesures de `preview.html`.
 */
export default function Actions() {
  return (
    <CataloguePage title="Actions">
      <Specimen name="Button" style={{ gap: 14 }}>
        <Row>
          <Button label="Publier mon bento" />
          <Button variant="secondary" size="md" icon="squares-four" label="Modifier" />
          <Button variant="secondary" size="md" icon="check" label="Abonné" />
        </Row>
        <Row>
          <Button variant="danger" size="md" label="Supprimer" />
          <Button variant="tertiary" size="md" label="Plus tard" />
          <Button variant="tertiary-danger" size="md" label="Le supprimer et continuer" />
        </Row>
        <Row>
          <Button size="sm" label="Accepter" />
          <Button size="sm" variant="secondary" label="Refuser" />
          <Button size="md" loading label="Connexion…" />
          <Button size="md" disabled label="Recevoir un code" />
        </Row>
        <BrandGround radius={16} style={{ width: 360, maxWidth: '100%', padding: 16 }}>
          <Button variant="on-brand" block label="Commencer" />
        </BrandGround>
      </Specimen>
      <Specimen name="IconButton">
        <Row gap={10}>
          <IconButton icon="caret-left" label="Retour" />
          <IconButton icon="gear-six" label="Réglages" />
          <IconButton icon="x" label="Fermer" variant="tonal" />
          <IconButton icon="dots-three" label="Options" variant="outline" />
          <IconButton icon="bell" label="Notifications" badge={3} />
          <IconButton icon="heart" label="J’aime" active />
        </Row>
      </Specimen>
      <Specimen name="Chip" style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8, overflow: 'hidden' }}>
          <Chip label="Mon bento" selected />
          <Chip label="Le grand inventaire" />
          <Chip label="Le retour du jeudi" variant="add" />
        </View>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: 380, maxWidth: '100%' }}
        >
          <Chip label="Hans Zimmer" count={2} variant="suggestion" />
          <Chip label="How To Train Your Dragon" count={2} variant="suggestion" />
          <Chip label="Squeezie" count={2} variant="suggestion" />
        </View>
      </Specimen>
    </CataloguePage>
  );
}

/** Une rangée de l'aperçu : 12 entre les éléments, centrés, à la ligne s'il le faut. */
function Row({ gap = 12, children }: { gap?: number; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap }}>
      {children}
    </View>
  );
}
