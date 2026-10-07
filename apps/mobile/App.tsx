import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@fc/tokens';
import { initI18n } from './src/i18n';
import { loadApiBase } from './src/lib/api';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen, { Feature } from './src/screens/HomeScreen';
import TabBar, { Tab } from './src/components/TabBar';
import ScanScreen from './src/screens/ScanScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';
import LandScreen from './src/features/land/LandScreen';
import SavedScreen from './src/features/land/SavedScreen';
import FertilizerScreen from './src/features/fertilizer/FertilizerScreen';
import type { SavedMeasurement } from './src/features/land/storage';

type Step = 'boot' | 'splash' | 'home' | Feature | 'landSaved' | 'farm' | 'profile';

/**
 * No login. The app opens straight into the three features.
 * ponytail: still a step variable rather than a navigation library -- the graph
 * is one level deep. Swap to expo-router when a feature needs nested screens.
 */
export default function App() {
  const [step, setStep] = useState<Step>('boot');
  const [editing, setEditing] = useState<SavedMeasurement | null>(null);

  const tabFor = (st: Step): Tab =>
    st === 'scan' ? 'scan' : st === 'farm' ? 'farm' : st === 'profile' ? 'profile' : 'home';
  const showTabs = ['home', 'farm', 'profile'].includes(step as string);

  useEffect(() => { Promise.all([initI18n(), loadApiBase()]).then(() => setStep('splash')); }, []);

  if (step === 'boot') {
    return (
      <View style={{ flex: 1, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={color.green} />
      </View>
    );
  }

  const home = () => setStep('home');

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {step === 'splash' && <SplashScreen onDone={home} />}
      {step === 'home' && <HomeScreen onOpen={(f) => setStep(f)} />}
      {step === 'scan' && <ScanScreen onClose={home} />}
      {step === 'land' && (
        <LandScreen
          initial={editing}
          onClose={() => { setEditing(null); home(); }}
          onOpenSaved={() => { setEditing(null); setStep('landSaved'); }}
        />
      )}
      {step === 'landSaved' && (
        <SavedScreen
          onOpen={(m) => { setEditing(m); setStep('land'); }}
          onNew={() => { setEditing(null); setStep('land'); }}
          onClose={home}
        />
      )}
      {step === 'fertilizer' && <FertilizerScreen onClose={home} />}
      {step === 'cropdoctor' && (
        <ComingSoonScreen title="Crop Doctor" note="Not started. Needs labelled crop-disease images." onClose={home} />
      )}
      {step === 'farm' && (
        <ComingSoonScreen title="My Farm" note="Not started." onClose={home} />
      )}
      {step === 'profile' && <SettingsScreen onClose={home} />}

      {showTabs && (
        <TabBar
          active={tabFor(step)}
          onChange={(tab) =>
            setStep(tab === 'scan' ? 'scan' : tab === 'farm' ? 'farm' : tab === 'profile' ? 'profile' : 'home')
          }
        />
      )}
    </SafeAreaProvider>
  );
}
