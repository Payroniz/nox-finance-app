import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

const logo = require('../../assets/splash.png');
const useNativeDriver = Platform.OS !== 'web';

export function AnimatedSplash({ ready, onFinish, onLayout }: { ready: boolean; onFinish: () => void; onLayout: () => void }) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const orbit = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); }).catch(() => { if (alive) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) { entrance.setValue(1); setMinimumElapsed(true); return; }
    const timer = setTimeout(() => setMinimumElapsed(true), 1400);
    const intro = Animated.timing(entrance, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver });
    const rotation = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver, isInteraction: false }));
    const breath = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver, isInteraction: false }),
    ]));
    intro.start(); rotation.start(); breath.start();
    return () => { clearTimeout(timer); intro.stop(); rotation.stop(); breath.stop(); };
  }, [reduceMotion, entrance, orbit, pulse]);

  useEffect(() => {
    if (!ready || !minimumElapsed) return;
    if (reduceMotion) { onFinish(); return; }
    const exit = Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver });
    const fallback = setTimeout(onFinish, 700);
    exit.start(({ finished }) => { if (finished) { clearTimeout(fallback); onFinish(); } });
    return () => { clearTimeout(fallback); exit.stop(); };
  }, [ready, minimumElapsed, reduceMotion, opacity, onFinish]);

  const moving = reduceMotion === false;
  return <Animated.View onLayout={onLayout} style={[styles.root, { opacity }]} accessibilityLabel="NoX açılıyor">
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 400 850" preserveAspectRatio="xMidYMid slice">
        <Defs><RadialGradient id="launchGlow"><Stop offset="0" stopColor="#7052D9" stopOpacity="0.3" /><Stop offset="1" stopColor="#0D1020" stopOpacity="0" /></RadialGradient></Defs>
        <Rect width="400" height="850" fill="#0D1020" /><Circle cx="200" cy="350" r="320" fill="url(#launchGlow)" />
        {[60, 130, 200, 270, 340].map(x => <Line key={x} x1={x} y1="0" x2={x} y2="850" stroke="#AA9BFF" strokeOpacity="0.035" />)}
        {[140, 210, 280, 350, 420, 490, 560, 630, 700].map(y => <Line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#AA9BFF" strokeOpacity="0.035" />)}
      </Svg>
    </View>
    <Animated.View style={[styles.center, moving && { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      <Text style={styles.eyebrow}>KENDİ GELECEĞİNİ PLANLA</Text>
      <View style={styles.orbitArea}>
        <Animated.View style={[styles.halo, moving && { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }] }]} />
        <Animated.View style={[StyleSheet.absoluteFill, moving && { transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <Svg width="280" height="280" viewBox="0 0 280 280"><Circle cx="140" cy="140" r="129" stroke="#AA9BFF28" strokeWidth="1" fill="none" /><Circle cx="140" cy="140" r="118" stroke="#AA9BFF70" strokeWidth="1.5" strokeDasharray="100 80 28 90" fill="none" /><Circle cx="140" cy="11" r="3" fill="#70E7DB" /><Circle cx="140" cy="269" r="2" fill="#AA9BFF" /></Svg>
        </Animated.View>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="NoX" />
      </View>
      <Text style={styles.title}>Kontrol sende.</Text>
      <Text style={styles.subtitle}>Emeğin, hedeflerin ve yarının.</Text>
      <View style={styles.steps}><Text style={styles.step}>ÇALIŞ</Text><View style={styles.dot} /><Text style={styles.step}>PLANLA</Text><View style={styles.dot} /><Text style={styles.step}>İLERLE</Text></View>
    </Animated.View>
    <View style={styles.footer}><View style={styles.track}><Animated.View style={[styles.bar, moving && { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [-34, 34] }) }] }]} /></View><Text accessibilityLiveRegion="polite" style={styles.status}>{ready ? 'Her şey hazır' : 'Finans alanın hazırlanıyor'}</Text></View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1020', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 36 },
  eyebrow: { color: '#AA9BFF', fontSize: 9, letterSpacing: 3, fontWeight: '600', marginBottom: 30 },
  orbitArea: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#AA9BFF0C', borderWidth: 1, borderColor: '#AA9BFF18' },
  logo: { width: 330, height: 330 },
  title: { fontSize: 28, fontWeight: '700', color: '#F2F4FF', letterSpacing: -0.7, marginTop: 32 },
  subtitle: { fontSize: 13, color: '#A4AEC8', marginTop: 12 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 28 },
  step: { color: '#70E7DB', fontSize: 8, fontWeight: '600', letterSpacing: 2 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#AA9BFF88' },
  footer: { position: 'absolute', bottom: '7%', alignItems: 'center', gap: 14 },
  track: { width: 100, height: 2, borderRadius: 2, backgroundColor: '#AA9BFF22', overflow: 'hidden', alignItems: 'center' },
  bar: { width: 32, height: 2, borderRadius: 2, backgroundColor: '#70E7DB' },
  status: { fontSize: 10, color: '#8F9AB7', letterSpacing: 0.4 },
});