import { Tabs } from 'expo-router';
import { Animated, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TabButton = Animated.createAnimatedComponent(Pressable);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: ({ style, ...props }) => (
          <TabButton {...props} style={[style, { paddingHorizontal: 0 }]} />
        ),
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBar,
          borderTopWidth: 0,
          height: 68 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontFamily: 'Poppins_500Medium',
          fontSize: 9,
          lineHeight: 14,
          flexShrink: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Ödemeler',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Abonelikler',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="repeat" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: 'Borçlar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-cash" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'İstatistik',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="timeline-clock-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
