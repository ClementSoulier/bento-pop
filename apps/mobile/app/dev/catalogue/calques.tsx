import { useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import { useToast } from '@/state/toast';
import {
  ActionSheet,
  AskSheet,
  Badge,
  Banner,
  Button,
  Confetti,
  Dialog,
  EmptyState,
  InAppNotice,
  Popy,
  PromptCard,
  SearchField,
  Sheet,
  SheetFooter,
  Skeleton,
  Spinner,
  Text,
  TextField,
  ThemeProvider,
  Toast,
  useTheme,
} from '@/design';

const OPTIONS = [
  { label: 'Signaler ce bento', icon: 'flag' as const, onPress: () => {} },
  { label: 'Signaler @lea.cine', icon: 'warning-circle' as const, onPress: () => {} },
  {
    label: 'Bloquer @lea.cine',
    icon: 'prohibit' as const,
    tone: 'danger' as const,
    onPress: () => {},
  },
];

/** Les textes de la confirmation de l'aperçu, insécables comme le veut le français. */
const DELETE_TITLE = 'Supprimer mon compte ?';
const DELETE_MESSAGE =
  'Toutes tes données seront effacées définitivement : pseudo, bento, items sélectionnés. Cette action est irréversible.';

/**
 * Le catalogue, page des calques et des retours (chantier 30, lot 4) : chaque
 * composant posé dans le cadre de son aperçu, aux mesures de `preview.html`
 * (`inline`), puis, sous les calques, un bouton qui l'ouvre pour de vrai, dans
 * sa `Modal`, pour éprouver le geste, le clavier et le lecteur d'écran.
 */
export default function Calques() {
  const noop = () => {};
  const [doctor, setDoctor] = useState('Doctor');
  const [sheet, setSheet] = useState(false);
  const [why, setWhy] = useState('');
  const [ask, setAsk] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [field, setField] = useState('');
  const showToast = useToast((s) => s.show);
  const [notice, setNotice] = useState(0);
  const [rain, setRain] = useState(0);
  return (
    <View style={{ flex: 1 }}>
      <CataloguePage title="Calques et retours">
        <Specimen name="Sheet" bleed>
          <Frame height={540}>
            <Sheet
              inline
              visible
              onClose={noop}
              height="full"
              eyebrow="Case"
              title="Série"
              action={{ label: 'Vider', onPress: () => setDoctor('') }}
            >
              <SearchField value={doctor} onChangeText={setDoctor} focused />
              <Text variant="eyebrow" color="text-secondary">
                1 résultat
              </Text>
            </Sheet>
          </Frame>
          <Open label="Ouvrir la feuille" onPress={() => setSheet(true)} />
          <Sheet
            visible={sheet}
            onClose={() => setSheet(false)}
            height="large"
            title="Tes pourquoi"
            subtitle="Une phrase par case."
            footer={
              <SheetFooter>
                <Button block label="Enregistrer" disabled={!why} onPress={() => setSheet(false)} />
              </SheetFooter>
            }
          >
            <TextField
              label="Film : Ponyo"
              placeholder="Pourquoi lui ?"
              value={why}
              onChangeText={setWhy}
            />
          </Sheet>
        </Specimen>
        <Specimen name="SheetFooter" bleed>
          <Frame height={280}>
            <Sheet
              inline
              visible
              onClose={noop}
              title="Tes pourquoi"
              subtitle="Une phrase par case."
              footer={
                <SheetFooter>
                  <Button block disabled label="Enregistrer" />
                </SheetFooter>
              }
            />
          </Frame>
        </Specimen>
        <Specimen name="AskSheet" bleed>
          <Frame height={500}>
            <AskSheet
              inline
              visible
              onClose={noop}
              mood="bisou"
              confetti
              title="Garde ton bento"
              message="Si tu changes de téléphone ou réinstalles l’app, ton adresse email suffira pour retrouver ton pseudo et tes bentos."
              primary="Garder mon compte"
              onPrimary={noop}
              secondary="Plus tard"
            />
          </Frame>
          <Open label="Ouvrir la demande" onPress={() => setAsk(true)} />
          <AskSheet
            visible={ask}
            onClose={() => setAsk(false)}
            mood="content"
            confetti
            title={'On te prévient quand une édition sort ?'}
            message={'Une notification par semaine, le jeudi à 18 h.'}
            primary="Oui"
            onPrimary={() => setAsk(false)}
            secondary="Non merci"
          />
        </Specimen>
        <Specimen name="ActionSheet" bleed>
          {/* L'aperçu montre « Annuler » coupé au bord de son cadre de 340 ;
              la marge du bas de la feuille l'y cachait tout entier. */}
          <Frame height={400}>
            <ActionSheet
              inline
              visible
              onClose={noop}
              title="Options pour @lea.cine"
              actions={OPTIONS}
            />
          </Frame>
          <Open label="Ouvrir le menu" onPress={() => setMenu(true)} />
          <ActionSheet
            visible={menu}
            onClose={() => setMenu(false)}
            title="Options pour @lea.cine"
            actions={OPTIONS}
          />
        </Specimen>
        <Specimen name="Dialog" bleed>
          <Frame height={450}>
            <Dialog
              inline
              visible
              mood="gene"
              title={DELETE_TITLE}
              message={DELETE_MESSAGE}
              actions={[
                { label: 'Supprimer', variant: 'danger', onPress: noop },
                { label: 'Annuler', variant: 'secondary', onPress: noop },
              ]}
              onCancel={noop}
            />
          </Frame>
          <Open label="Ouvrir la confirmation" onPress={() => setDialog(true)} />
          <Dialog
            visible={dialog}
            mood="gene"
            title={DELETE_TITLE}
            message={DELETE_MESSAGE}
            actions={[
              { label: 'Supprimer', variant: 'danger', onPress: () => setDialog(false) },
              { label: 'Annuler', variant: 'secondary', onPress: () => setDialog(false) },
            ]}
            onCancel={() => setDialog(false)}
          />
        </Specimen>
        <Specimen name="Toast" bleed style={{ gap: 10 }}>
          <Frame height={80}>
            <Toast inline message="Compte gardé" icon="check-circle" offset={14} onDismiss={noop} />
          </Frame>
          <ThemeProvider scheme="dark">
            <Frame height={80}>
              <Toast
                inline
                message="Créateur de contenu : Squeezie"
                action="Annuler"
                icon="arrows-clockwise"
                offset={14}
                onDismiss={noop}
              />
            </Frame>
          </ThemeProvider>
          {/* Par la file des toasts de l'app et son hôte (chantier 31) : en bas,
              au-dessus de la zone sûre ici, du clavier quand il est ouvert. */}
          <Open
            label="Montrer un toast"
            onPress={() =>
              showToast('Créateur de contenu : Squeezie', {
                variant: 'success',
                icon: 'arrows-clockwise',
                action: { label: 'Annuler', onPress: noop },
              })
            }
          />
          <Open
            label="Montrer une erreur"
            onPress={() =>
              showToast("La case n'a pas pu être enregistrée. Réessaie.", {
                variant: 'danger',
                durationMs: 5000,
              })
            }
          />
          <Open
            label="Montrer un toast dans 4 s"
            onPress={() =>
              setTimeout(() => showToast('Compte gardé', { variant: 'success' }), 4000)
            }
          />
          <View style={{ paddingHorizontal: 16 }}>
            <TextField
              label="Un champ, pour ouvrir le clavier"
              value={field}
              onChangeText={setField}
            />
          </View>
        </Specimen>
        <Specimen name="Banner" bleed style={{ gap: 12 }}>
          <Frame height={40} flow>
            <Banner tone="offline" />
          </Frame>
          <Frame height={84} flow>
            <Banner
              tone="update"
              title="Nouvelle version dispo"
              action="Mettre à jour"
              onAction={noop}
              onClose={noop}
            />
          </Frame>
        </Specimen>
        <Specimen name="InAppNotice" bleed>
          <Frame height={120}>
            <InAppNotice
              inline
              top={4}
              title="Proposition validée"
              message="« Ponyo » est au catalogue : ta case est en ligne."
              onPress={noop}
              onDismiss={noop}
            />
          </Frame>
          <Open label="Recevoir une notification" onPress={() => setNotice((n) => n + 1)} />
        </Specimen>
        <Specimen name="EmptyState">
          <EmptyState
            mood="content"
            message="Ici arrivent les likes, les commentaires et les abonnés de ton bento."
            action="Compose le tien"
            onAction={noop}
          />
        </Specimen>
        <Specimen name="PromptCard">
          <PromptCard
            mood="intello"
            text="Garde ton compte pour commenter. Un code par mail, et tes commentaires te suivent d’un téléphone à l’autre."
            action="Garder mon compte"
            onAction={noop}
          />
        </Specimen>
        <Specimen name="Confetti" bleed>
          <Frame height={200}>
            <Confetti key={rain} />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <Popy mood="bisou" size={96} />
            </View>
          </Frame>
          <Open label="Rejouer" onPress={() => setRain((n) => n + 1)} />
        </Specimen>
        <Specimen name="Skeleton">
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}
          >
            <View style={{ width: 300 }}>
              <Skeleton kind="post" />
            </View>
            <View style={{ width: 300 }}>
              <Skeleton kind="list" rows={4} />
            </View>
          </View>
        </Specimen>
        <Specimen name="Spinner">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Spinner size={18} />
            <Spinner size={28} />
            <Button size="md" loading label="Préparation…" />
          </View>
        </Specimen>
        <Specimen name="Badge">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Badge count={7} />
            <Badge count={128} />
            <Badge dot label="Nouveau" />
          </View>
        </Specimen>
      </CataloguePage>
      {/* Hors du défilement : la notification se pose sur l'écran. */}
      {notice > 0 ? (
        <InAppNotice
          key={`notice-${notice}`}
          title="Proposition validée"
          message="« Ponyo » est au catalogue : ta case est en ligne."
          onPress={noop}
          onDismiss={() => setNotice(0)}
        />
      ) : null}
    </View>
  );
}

/**
 * Le cadre d'un aperçu de calque : un écran de 402 de large, de la hauteur de
 * l'aperçu, aux coins de 16, et son filet par-dessus, qui ne décale rien,
 * comme l'ombre intérieure de `preview.html`. Un calque s'y pose en absolu :
 * le cadre grandit avec le texte du système, jusqu'au double de sa hauteur,
 * pour qu'à 130 et 200 % on juge le calque et non la découpe du cadre ; ce
 * qui suit le flux (`flow`), une bannière, le fait grandir de lui-même.
 */
function Frame({
  height,
  flow,
  children,
}: {
  height: number;
  flow?: boolean;
  children: ReactNode;
}) {
  const { colors, border } = useTheme();
  const { fontScale } = useWindowDimensions();
  const grown = Math.round(height * Math.min(Math.max(fontScale, 1), 2));
  return (
    <View
      style={{
        width: 402,
        maxWidth: '100%',
        ...(flow ? { minHeight: height } : { height: grown }),
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 16,
        backgroundColor: colors['bg-app'],
      }}
    >
      {children}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: 16, borderWidth: border.hairline, borderColor: colors['border-subtle'] },
        ]}
      />
    </View>
  );
}

/** Le bouton qui ouvre le calque pour de vrai, sous son aperçu. */
function Open({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      variant="secondary"
      size="md"
      label={label}
      onPress={onPress}
      style={{ alignSelf: 'center' }}
    />
  );
}
