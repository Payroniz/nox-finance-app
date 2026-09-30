import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useMeasureTabBar } from './TabBarInset';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: 'home-outline', payments: 'calendar-check-outline', subscriptions: 'repeat', debts: 'account-cash-outline',
  stats: 'chart-box-outline', planner: 'calendar-clock-outline', settings: 'cog-outline',
};

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const measureTabBar = useMeasureTabBar();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [offset, setOffset] = useState(0);
  const tabWidth = Math.max(88, (Math.min(width, 900) - 46) / state.routes.length);
  useEffect(() => {
    if (viewport) scroll.current?.scrollTo({ x: Math.max(0, state.index * tabWidth - (viewport - tabWidth) / 2), animated: true });
  }, [state.index, tabWidth, viewport]);
  const canScroll = viewport > 0 && tabWidth * state.routes.length > viewport + 8;
  const atEnd = offset + viewport >= tabWidth * state.routes.length - 12;
  return <View onLayout={event => measureTabBar(event.nativeEvent.layout.height)} style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 10), paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) }]}>
    <View style={styles.capsule}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}
        onLayout={event => setViewport(event.nativeEvent.layout.width)} onScroll={event => setOffset(event.nativeEvent.contentOffset.x)} scrollEventThrottle={32}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          return <TouchableOpacity key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={[styles.item, { width: tabWidth }, focused && styles.selected]} activeOpacity={0.8}>
            <MaterialCommunityIcons name={ICONS[route.name] ?? 'circle-outline'} size={25} color={focused ? Colors.primaryLight : Colors.textSecondary} />
            <Text numberOfLines={1} style={[styles.label, focused && styles.activeLabel]}>{options.title ?? route.name}</Text>
          </TouchableOpacity>;
        })}
      </ScrollView>
      {canScroll && <TouchableOpacity accessibilityRole="button" accessibilityLabel={atEnd ? 'İlk menüleri göster' : 'Diğer menüleri göster'} style={styles.more}
        onPress={() => scroll.current?.scrollTo({ x: atEnd ? 0 : offset + viewport * 0.7, animated: true })}>
        <MaterialCommunityIcons name={atEnd ? 'chevron-left' : 'chevron-right'} color={Colors.textSecondary} size={18} />
      </TouchableOpacity>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent', paddingTop: 8, pointerEvents: 'box-none' },
  capsule: { alignSelf: 'center', width: '100%', maxWidth: 900, backgroundColor: Colors.tabBar, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: 42, flexDirection: 'row', overflow: 'hidden', padding: 4 },
  items: { alignItems: 'center' },
  item: { minHeight: 62, paddingVertical: 7, paddingHorizontal: 4, gap: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 34 },
  selected: { backgroundColor: `${Colors.primary}22` },
  label: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: Colors.textSecondary },
  activeLabel: { color: Colors.primaryLight, fontFamily: 'Poppins_600SemiBold' },
  more: { width: 28, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
});