import { StyleSheet, View } from 'react-native';

import FitlabLogoIntro from '@/components/liquid-glass-logo/fitlab-logo-intro';

const HEIGHT = 480;

/** Preview of the liquid-glass logo intro, on black. */
export default function LogoIntroScreen() {
  return (
    <View style={styles.page}>
      <FitlabLogoIntro height={HEIGHT} dom={{ style: { width: '100%', height: HEIGHT, backgroundColor: '#000000' }, scrollEnabled: false }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000', justifyContent: 'center' },
});
