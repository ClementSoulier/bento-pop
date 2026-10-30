import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import {
  Checkbox,
  CodeField,
  List,
  ListRow,
  RadioRow,
  Rule,
  SearchField,
  Switch,
  Text,
  TextField,
  ThemeProvider,
  useTheme,
} from '@/design';

/**
 * Le catalogue, page des listes et de la saisie (chantier 30, lot 4) : chaque
 * composant dans les états de son aperçu, aux mesures de `preview.html`, et
 * qui répond au toucher.
 */
export default function Saisie() {
  const [items, setItems] = useState(true);
  const [editions, setEditions] = useState(false);
  const [followers, setFollowers] = useState(true);
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [rules, setRules] = useState(false);
  const [short, setShort] = useState(true);
  const [reason, setReason] = useState('Spam ou arnaque');
  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [taken, setTaken] = useState('bento21');
  const [detail, setDetail] = useState('');
  const [query, setQuery] = useState('');
  const [doctor, setDoctor] = useState('Doctor');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState('335482');
  return (
    <CataloguePage title="Listes et saisie">
      <Specimen name="List">
        <List header="Notifications" footer="Réglé sur ce téléphone.">
          <ListRow
            icon="check-circle"
            title="Mes items"
            subtitle="Quand l’équipe valide ou refuse ce que tu proposes."
            trailing="switch"
            checked={items}
            onValueChange={setItems}
          />
          <ListRow
            icon="sparkle"
            title="Les éditions"
            subtitle={'Quand une nouvelle édition sort, le jeudi à 18 h.'}
            trailing="switch"
            checked={editions}
            onValueChange={setEditions}
          />
        </List>
      </Specimen>
      <Specimen name="ListRow">
        <List>
          <ListRow icon="sparkle" title="Crédits & attributions" onPress={() => {}} />
          <ListRow title="Site officiel · bento-pop.com" trailing="external" onPress={() => {}} />
          <ListRow
            icon="user-check"
            title="Valider mes abonnés"
            subtitle="Chaque nouvel abonné attend ton accord."
            note="Les demandes t’attendent en tête de tes abonnés."
            trailing="switch"
            checked={followers}
            onValueChange={setFollowers}
          />
          <ListRow icon="download-simple" title="Export en cours…" trailing="spinner" />
          <ListRow
            icon="seal-check"
            title="Compte gardé"
            detail="t•••@bento.test"
            trailing="none"
          />
          <ListRow
            icon="trash"
            title="Supprimer mon compte"
            tone="danger"
            trailing="none"
            onPress={() => {}}
          />
        </List>
      </Specimen>
      <Specimen name="Switch">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <Switch checked={on} onValueChange={setOn} label="Allumé" />
          <Switch checked={off} onValueChange={setOff} label="Éteint" />
          <ThemeProvider scheme="dark">
            <DarkPanel>
              <Switch checked={on} onValueChange={setOn} label="Allumé" />
              <Switch checked={off} onValueChange={setOff} label="Éteint" />
            </DarkPanel>
          </ThemeProvider>
        </View>
      </Specimen>
      <Specimen name="Checkbox" style={{ gap: 14 }}>
        <View style={{ width: 360, maxWidth: '100%' }}>
          <Checkbox
            checked={rules}
            onValueChange={setRules}
            label="J’ai lu et j’accepte les règles ci-dessus, les CGU et la politique de confidentialité."
          />
        </View>
        <View style={{ width: 360, maxWidth: '100%' }}>
          <Checkbox
            checked={short}
            onValueChange={setShort}
            label="J’ai lu et j’accepte les règles ci-dessus."
          />
        </View>
      </Specimen>
      <Specimen name="RadioRow">
        <List>
          {['Haine ou discrimination', 'Spam ou arnaque', 'Autre'].map((label) => (
            <RadioRow
              key={label}
              label={label}
              checked={reason === label}
              onPress={() => setReason(label)}
            />
          ))}
        </List>
      </Specimen>
      <Specimen name="TextField" style={{ gap: 18 }}>
        <TextField
          label="Adresse email"
          placeholder="ton@adresse.fr"
          focused
          helper="Elle n’est jamais affichée."
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          accessibilityLabel="Ton pseudo"
          prefix="@"
          placeholder="ton_pseudo"
          helper="bento-pop.com/u/ton_pseudo"
          helperRight={`${pseudo.length} / 20`}
          value={pseudo}
          onChangeText={setPseudo}
          maxLength={20}
          autoCapitalize="none"
        />
        <TextField
          label="Ton pseudo"
          prefix="@"
          value={taken}
          onChangeText={setTaken}
          error="Ce pseudo est déjà pris. Essaie @bento_culture."
          autoCapitalize="none"
        />
        <TextField
          label="Un détail, si tu veux"
          placeholder="Ce qui s’est passé"
          multiline
          value={detail}
          onChangeText={setDetail}
        />
      </Specimen>
      <Specimen name="SearchField">
        <SearchField
          placeholder="pseudo, film, série, artiste…"
          value={query}
          onChangeText={setQuery}
        />
        <SearchField value={doctor} onChangeText={setDoctor} focused />
      </Specimen>
      <Specimen name="CodeField" style={{ gap: 14 }}>
        <CodeField value={code} onChangeText={setCode} focused />
        <CodeField value={sent} onChangeText={setSent} focused={false} />
      </Specimen>
      <Specimen name="Rule">
        <Rule icon="prohibit" tone="no">
          Pas de spam, pas d’arnaque, pas de doxxing.
        </Rule>
        <Rule icon="flag">
          Tu peux{' '}
          <Text variant="body" weight={600}>
            signaler
          </Text>{' '}
          tout bento qui te paraît hors-limites.
        </Rule>
      </Specimen>
    </CataloguePage>
  );
}

/** Le cadre sombre de l'aperçu de `Switch` : fond de surface du thème sombre, 12 de marge, coins de 12. */
function DarkPanel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors['bg-surface'],
      }}
    >
      {children}
    </View>
  );
}
