import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '@/design';
import { toastBottom, toastIcon } from '@/design/overlays/toast-rules';
import { useToast } from '@/state/toast';

/**
 * Les modales qui montent leur propre hôte : sur iOS, une modale native se
 * pose au-dessus de toute la racine, et le toast de la racine y restait caché
 * (recette du lot 2 du 31). La recherche d'une case est la seule à lever un
 * toast pendant qu'elle est ouverte, quand une écriture échoue.
 */
const OWN_HOST = new Set(['search-modal']);

/**
 * L'hôte des toasts de l'app (chantier 31, D7) : le `Toast` du design, en bas,
 * 8 points au-dessus de la barre d'onglets sur une racine, 12 au-dessus de la
 * zone sûre ailleurs, 12 au-dessus du clavier quand il est ouvert. Il reste
 * au moins 4 s, 6 s avec une action, part quand on le touche, et se dit au
 * lecteur d'écran avec son action, sans prendre son focus.
 *
 * Monté une fois à la racine, et dans chaque modale d'`OWN_HOST`
 * (`scope="modal"`), où il ne montre que les toasts levés depuis son
 * ouverture ; la racine s'efface tant qu'une de ces modales est devant.
 * `FullWindowOverlay`, essayé d'abord, cachait tout l'écran à VoiceOver le
 * temps du toast et lui prenait son focus.
 */
export function ToastHost({ scope = 'root' }: { scope?: 'root' | 'modal' }) {
  const message = useToast((s) => s.message);
  const variant = useToast((s) => s.variant);
  const icon = useToast((s) => s.icon);
  const action = useToast((s) => s.action);
  const durationMs = useToast((s) => s.durationMs);
  const seq = useToast((s) => s.seq);
  const dismiss = useToast((s) => s.dismiss);
  const since = useRef(useToast.getState().seq).current;
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const ownHostInFront = OWN_HOST.has(segments[0] ?? '');
  const mine = scope === 'root' ? !ownHostInFront : ownHostInFront && seq > since;
  if (!message || !mine) return null;
  return (
    <Toast
      key={seq}
      message={message}
      icon={icon ?? toastIcon(variant)}
      action={action?.label}
      onAction={action?.onPress}
      duration={durationMs ?? undefined}
      onDismiss={() => dismiss(seq)}
      offset={toastBottom({
        tabBar: segments[0] === '(tabs)',
        insetBottom: insets.bottom,
        // Android annonce un clavier sans la barre de navigation qu'il
        // recouvre (24 dp mesurés au Pixel 8, au lot 2) : on la lui rend.
        keyboard: keyboard > 0 && Platform.OS === 'android' ? keyboard + insets.bottom : keyboard,
      })}
    />
  );
}

/** La hauteur du clavier à l'écran, 0 quand il est fermé. */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}
