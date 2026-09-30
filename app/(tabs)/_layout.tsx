import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { TabBarInsetProvider } from '../../src/components/TabBarInset';

export default function TabLayout() {
  return <TabBarInsetProvider><Tabs tabBar={props => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
    <Tabs.Screen name="payments" options={{ title: 'Ödemeler' }} />
    <Tabs.Screen name="subscriptions" options={{ title: 'Abonelikler' }} />
    <Tabs.Screen name="debts" options={{ title: 'Borçlar' }} />
    <Tabs.Screen name="stats" options={{ title: 'İstatistik' }} />
    <Tabs.Screen name="planner" options={{ title: 'Plan' }} />
    <Tabs.Screen name="settings" options={{ title: 'Ayarlar' }} />
  </Tabs></TabBarInsetProvider>;
}