import { useEffect, useRef } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import { StampButton } from '@/components/primitives';
import { AccountText, AccountTitle, TextButton } from '@/components/account/AccountParts';
import { releaseEditorialOffer } from '@/lib/keep-offer';

/**
 * La feuille « Garde ton bento », chantier 28 (D4) : au moment où il y a
 * quelque chose à perdre. Une fois par compte, cf. `offerKeepAccount`, et
 * passée en un tap. L'accord des éditions attend derrière elle (D11).
 */
export default function KeepOfferSheet() {
  // Fermée par « Plus tard », par le geste du système ou par « Garder mon
  // compte », qui la remplace par l'écran du même nom : celui-ci prend alors
  // le relais de l'accord des éditions.
  const replacedByKeep = useRef(false);
  useEffect(
    () => () => {
      if (!replacedByKeep.current) releaseEditorialOffer();
    },
    [],
  );

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/compose');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf3de' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}>
          <Image
            source={popyContent}
            accessibilityIgnoresInvertColors
            style={{ width: 120, height: 120, alignSelf: 'center', transform: [{ rotate: '-4deg' }] }}
            resizeMode="contain"
          />
          <AccountTitle>Garde ton bento</AccountTitle>
          <AccountText>
            Si tu changes de téléphone ou réinstalles l'app, ton adresse email suffira pour retrouver ton
            pseudo et tes bentos.
          </AccountText>
          <View style={{ marginTop: 28 }}>
            <StampButton
              wide
              onPress={() => {
                replacedByKeep.current = true;
                router.replace('/account/keep');
              }}
            >
              Garder mon compte
            </StampButton>
          </View>
          <TextButton label="Plus tard" onPress={close} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
