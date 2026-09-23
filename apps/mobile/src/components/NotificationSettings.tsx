import { useCallback, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SettingSwitch, useToast } from '@/components/primitives';
import { type DeviceSettings, type NotificationSection, notificationSection } from '@/lib/push';
import {
  enablePushFromProfile,
  openNotificationSettings,
  readChannelBlocks,
  readDeviceSettings,
  readPermission,
  writeDeviceSetting,
} from '@/lib/push-runtime';

/**
 * La section « Notifications » du profil. Chantier 17, lot 4, §5.4.
 *
 * Deux interrupteurs, « Mes items » et « Les éditions », réglés sur ce
 * téléphone (D8). Couper un type dans l'app ne retire pas l'autorisation du
 * système, et l'inverse non plus : la section dit lequel des deux bloque,
 * plutôt que de montrer deux interrupteurs qui ne serviraient à rien.
 */
export function NotificationSettings() {
  const [section, setSection] = useState<NotificationSection | null>(null);
  const [busy, setBusy] = useState(false);
  const showToast = useToast((s) => s.show);

  const load = useCallback(async () => {
    try {
      const permission = await readPermission();
      const [device, channels] = await Promise.all([
        permission.granted ? readDeviceSettings().catch(() => null) : Promise.resolve(null),
        readChannelBlocks().catch(() => ({ items: false, editions: false })),
      ]);
      setSection(notificationSection({ permission, device, channels }));
    } catch (e) {
      console.warn('[profil] notifications', e);
      setSection({ state: 'unavailable' });
    }
  }, []);

  // À chaque passage sur l'onglet, et au retour des réglages du téléphone,
  // où tout a pu changer.
  useFocusEffect(
    useCallback(() => {
      void load();
      const abonnement = AppState.addEventListener('change', (etat) => {
        if (etat === 'active') void load();
      });
      return () => abonnement.remove();
    }, [load]),
  );

  const toggle = async (setting: keyof DeviceSettings, on: boolean) => {
    if (section?.state !== 'ready' || busy) return;
    const avant = section;
    // Tout de suite à l'écran, rendu si l'écriture échoue.
    setSection(
      setting === 'transactional'
        ? { ...section, items: { ...section.items, on } }
        : { ...section, editions: { ...section.editions, on } },
    );
    setBusy(true);
    try {
      await writeDeviceSetting(setting, on);
    } catch (e) {
      console.warn('[profil] réglage des notifications', e);
      setSection(avant);
      showToast("Le réglage n'a pas été enregistré. Réessaie.", { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    setBusy(true);
    try {
      await enablePushFromProfile();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 24, gap: 8 }}>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 2,
          color: INK_MUTED,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        Notifications
      </Text>

      {/* Tant que la lecture n'a pas répondu, rien : un état deviné
          clignoterait d'un écran à l'autre. */}
      {section === null ? null : section.state === 'ready' ? (
        <>
          <SettingSwitch
            label="Mes items"
            description="Quand l'équipe valide ou refuse ce que tu proposes."
            value={section.items.on}
            onChange={(on) => void toggle('transactional', on)}
            note={section.items.blockedBySystem ? "Coupé dans les réglages d'Android." : undefined}
            disabled={busy}
          />
          <SettingSwitch
            label="Les éditions"
            description="Quand une nouvelle édition sort, le jeudi à 18 h."
            value={section.editions.on}
            onChange={(on) => void toggle('editorial', on)}
            note={section.editions.blockedBySystem ? "Coupé dans les réglages d'Android." : undefined}
            disabled={busy}
          />
          {section.items.blockedBySystem || section.editions.blockedBySystem ? (
            <ActionRow label="Ouvrir les réglages" onPress={openNotificationSettings} />
          ) : null}
          <Hint>Réglé sur ce téléphone.</Hint>
        </>
      ) : section.state === 'ask' ? (
        <>
          <Hint>Les notifications sont éteintes sur ce téléphone.</Hint>
          <ActionRow
            label={busy ? 'Un instant…' : 'Activer les notifications'}
            onPress={busy ? () => {} : () => void enable()}
          />
        </>
      ) : section.state === 'blocked' ? (
        <>
          <Hint>Les notifications sont coupées dans les réglages du téléphone.</Hint>
          <ActionRow label="Ouvrir les réglages" onPress={openNotificationSettings} />
        </>
      ) : (
        <Hint>Ce téléphone ne peut pas recevoir de notifications pour l’instant.</Hint>
      )}
    </View>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <Text
      maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
      style={{ fontSize: 12, color: INK_MUTED }}
    >
      {children}
    </Text>
  );
}

/** Même aspect que les lignes du profil : blanches, cerclées, un chevron. */
function ActionRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        style={{ fontSize: 14, fontWeight: '600', flexShrink: 1 }}
      >
        {label}
      </Text>
      <Text allowFontScaling={false} style={{ fontSize: 18, color: INK_PLACEHOLDER }}>
        ›
      </Text>
    </Pressable>
  );
}
