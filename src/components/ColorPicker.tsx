import React, { useEffect, useId, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../constants/theme';
import { hexToHsv, hsvToHex, normalizeHexColor } from '../utils/colors';

type Props = { value: string; onChange: (color: string) => void; onInteractionChange?: (dragging: boolean) => void };

export const ColorPicker = ({ value, onChange, onInteractionChange }: Props) => {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [draft, setDraft] = useState(value);
  const widths = useRef({ palette: 1, hue: 1 });
  const lastEmitted = useRef(value);
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    if (lastEmitted.current !== value) {
      setHsv(hexToHsv(value));
      setDraft(value);
      lastEmitted.current = value;
    }
  }, [value]);

  const update = (next: typeof hsv) => {
    const color = hsvToHex(next.h, next.s, next.v);
    setHsv(next);
    setDraft(color);
    lastEmitted.current = color;
    onChange(color);
  };
  const drag = (event: GestureResponderEvent, area: 'palette' | 'hue') => {
    const x = Math.max(0, Math.min(1, event.nativeEvent.locationX / widths.current[area]));
    if (area === 'hue') update({ ...hsv, h: x * 360 });
    else update({ ...hsv, s: x, v: 1 - Math.max(0, Math.min(1, event.nativeEvent.locationY / 180)) });
  };
  const handlers = (area: 'palette' | 'hue') => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (event: GestureResponderEvent) => { onInteractionChange?.(true); drag(event, area); },
    onResponderMove: (event: GestureResponderEvent) => drag(event, area),
    onResponderRelease: () => onInteractionChange?.(false),
    onResponderTerminate: () => onInteractionChange?.(false),
    onResponderTerminationRequest: () => false,
  });

  return <View style={styles.container}>
    <View testID="color-palette" accessibilityLabel="Renk doygunluğu ve parlaklığı" style={styles.palette}
      onLayout={event => { widths.current.palette = event.nativeEvent.layout.width; }} {...handlers('palette')}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${id}white`} x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset="0" stopColor="white" /><Stop offset="1" stopColor="white" stopOpacity={0} /></LinearGradient>
            <LinearGradient id={`${id}black`} x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0" stopColor="black" stopOpacity={0} /><Stop offset="1" stopColor="black" /></LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={hsvToHex(hsv.h, 1, 1)} />
          <Rect width="100%" height="100%" fill={`url(#${id}white)`} />
          <Rect width="100%" height="100%" fill={`url(#${id}black)`} />
        </Svg>
      </View>
      <View pointerEvents="none" style={[styles.cursor, { left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }]} />
    </View>
    <View testID="color-hue" accessibilityRole="adjustable" accessibilityLabel="Renk tonu"
      accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.h) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => update({ ...hsv, h: (hsv.h + (event.nativeEvent.actionName === 'increment' ? 10 : 350)) % 360 })}
      style={styles.hue} onLayout={event => { widths.current.hue = event.nativeEvent.layout.width; }} {...handlers('hue')}>
      <View pointerEvents="none" style={styles.hueGradient}>
        <Svg width="100%" height="100%"><Defs><LinearGradient id={`${id}hue`} x1="0%" y1="0%" x2="100%" y2="0%">
          {['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'].map((color, index) => <Stop key={index} offset={index / 6} stopColor={color} />)}
        </LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id}hue)`} /></Svg>
      </View>
      <View pointerEvents="none" style={[styles.cursor, { left: `${hsv.h / 360 * 100}%`, top: 22, backgroundColor: hsvToHex(hsv.h, 1, 1) }]} />
    </View>
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: value }]} />
      <Text style={styles.label}>HEX</Text>
      <TextInput testID="subscription-color" accessibilityLabel="Kart rengi HEX kodu" style={styles.input} value={draft}
        autoCapitalize="characters" autoCorrect={false} maxLength={7}
        onChangeText={text => {
          setDraft(text);
          if (/^#?[\da-f]{6}$/i.test(text)) {
            const color = normalizeHexColor(text)!;
            setHsv(hexToHsv(color)); lastEmitted.current = color; onChange(color);
          }
        }}
        onBlur={() => {
          const color = normalizeHexColor(draft) ?? value;
          setDraft(color); setHsv(hexToHsv(color)); lastEmitted.current = color; onChange(color);
        }} />
    </View>
    <Text style={styles.hint}>Paleti ve renk şeridini sürükle veya renk kodunu gir. Yazılar kartın rengine uyum sağlar.</Text>
  </View>;
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  palette: { height: 180, borderRadius: 12, overflow: 'hidden' },
  hue: { height: 44, justifyContent: 'center', marginHorizontal: 10 },
  hueGradient: { height: 24, borderRadius: 12, overflow: 'hidden' },
  cursor: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#fff', marginLeft: -10, marginTop: -10, boxShadow: '0px 0px 2px 1px #000000' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  swatch: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder },
  label: { color: Colors.textSecondary, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  input: { flex: 1, minHeight: 48, padding: 12, color: Colors.textPrimary, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder },
  hint: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 11 },
});
