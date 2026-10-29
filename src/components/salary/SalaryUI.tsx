import React, { useId, useState } from 'react';
import { ActivityIndicator, Platform, StyleProp, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { formatDate, formatLocalDateKey, parseLocalDate } from '../../utils/helpers';

export const SalaryColors = { background: '#0D1020', surface: '#171C30', inset: '#101526', border: '#303852', text: '#F2F4FF', muted: '#A4AEC8', purple: '#AA9BFF', cyan: '#70E7DB', danger: '#FF8698', warning: '#FFD08C' };
export type SalaryIcon = keyof typeof MaterialCommunityIcons.glyphMap;
export type SalaryTone = 'purple' | 'cyan' | 'danger';

export function SalaryGlow({ tone = 'purple' }: { tone?: SalaryTone }) {
  const id = `salary${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const color = SalaryColors[tone];
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 250">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.18" /><Stop offset="0.65" stopColor={color} stopOpacity="0.025" /><Stop offset="1" stopColor={color} stopOpacity="0.08" /></LinearGradient></Defs>
      <Rect width="400" height="250" fill={`url(#${id})`} />
      <Circle cx="395" cy="15" r="95" stroke={color} strokeOpacity="0.12" fill="none" />
      <Circle cx="395" cy="15" r="135" stroke={color} strokeOpacity="0.07" fill="none" />
      <Path d="M0 224 H55 L70 209 H128 M290 0 V30 L312 52 H400" stroke={color} strokeOpacity="0.16" fill="none" />
      <Circle cx="128" cy="209" r="2" fill={color} fillOpacity="0.3" />
    </Svg>
  </View>;
}

export function SalaryPanel({ children, tone, style }: { children: React.ReactNode; tone?: SalaryTone; style?: StyleProp<ViewStyle> }) {
  return <View style={[ui.panel, tone && { borderColor: `${SalaryColors[tone]}45` }, style]}>{tone && <SalaryGlow tone={tone} />}{children}</View>;
}

export function SalaryIconTile({ icon, tone = 'purple', size = 42 }: { icon: SalaryIcon; tone?: SalaryTone; size?: number }) {
  return <View style={[ui.iconTile, { width: size, height: size, backgroundColor: `${SalaryColors[tone]}12`, borderColor: `${SalaryColors[tone]}30` }]}><MaterialCommunityIcons name={icon} size={size > 48 ? 29 : 21} color={SalaryColors[tone]} /></View>;
}

export function SalaryButton({ label, onPress, disabled, secondary, danger, icon = 'arrow-right', busy }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean; icon?: SalaryIcon; busy?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy }} disabled={disabled || busy} activeOpacity={0.8} onPress={onPress}
    style={[ui.button, secondary && ui.secondaryButton, danger && ui.dangerButton, (disabled || busy) && ui.disabled]}>
    {!secondary && <SalaryGlow tone={danger ? 'danger' : 'purple'} />}
    {busy ? <ActivityIndicator color={SalaryColors.text} /> : <MaterialCommunityIcons name={icon} size={19} color={secondary ? SalaryColors.muted : '#FFFFFF'} />}
    <Text style={[ui.buttonText, secondary && { color: SalaryColors.muted }]}>{label}</Text>
  </TouchableOpacity>;
}

export function SalaryIconButton({ icon, label, onPress, disabled, danger }: { icon: SalaryIcon; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[ui.iconButton, disabled && ui.disabled]}>
    <MaterialCommunityIcons name={icon} size={21} color={danger ? SalaryColors.danger : SalaryColors.purple} /></TouchableOpacity>;
}

export function SalaryChip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: SalaryIcon }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }} activeOpacity={0.8} onPress={onPress} style={[ui.chip, selected && ui.selectedChip]}>
    {icon && <MaterialCommunityIcons name={icon} size={17} color={selected ? SalaryColors.cyan : SalaryColors.muted} />}<Text style={[ui.chipText, selected && { color: SalaryColors.text }]}>{label}</Text>
  </TouchableOpacity>;
}

export function SalaryField({ label, value, onChange, numeric, placeholder, maxLength = 500, icon, large, unit }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; placeholder?: string; maxLength?: number; icon?: SalaryIcon; large?: boolean; unit?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={ui.field}><Text style={ui.label}>{label}</Text><View style={[ui.inputWrap, focused && ui.inputFocused, large && ui.inputLarge]}>
    {icon && <MaterialCommunityIcons name={icon} size={20} color={focused ? SalaryColors.cyan : SalaryColors.muted} />}
    <TextInput accessibilityLabel={label} style={[ui.input, large && ui.largeInput]} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'}
      placeholder={placeholder} placeholderTextColor="#73809E" selectionColor={SalaryColors.cyan} maxLength={maxLength} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    {!!unit && <Text style={ui.unit}>{unit}</Text>}
  </View></View>;
}

export function SalaryDateField({ label, value, onChange, minimumDate, maximumDate, optional }: { label: string; value: string; onChange: (value: string) => void; minimumDate?: Date; maximumDate?: Date; optional?: boolean }) {
  const [visible, setVisible] = useState(false);
  const fallback = parseLocalDate(value) ?? minimumDate ?? new Date();
  const date = new Date(Math.max(minimumDate?.getTime() ?? -Infinity, Math.min(maximumDate?.getTime() ?? Infinity, fallback.getTime())));
  return <View style={ui.field}>
    {Platform.OS === 'web' ? <SalaryField label={`${label} (YYYY-AA-GG)`} value={value} onChange={onChange} icon="calendar-blank-outline" placeholder={optional ? 'İsteğe bağlı' : '2026-11-01'} maxLength={10} />
      : <><Text style={ui.label}>{label}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} seç`} style={ui.inputWrap} onPress={() => setVisible(true)}><MaterialCommunityIcons name="calendar-blank-outline" size={20} color={SalaryColors.cyan} /><Text style={ui.dateText}>{value ? formatDate(value, 'd MMM yyyy') : 'Tarih seç (isteğe bağlı)'}</Text><MaterialCommunityIcons name="chevron-down" size={18} color={SalaryColors.muted} /></TouchableOpacity>
        <DateTimePickerModal isVisible={visible} mode="date" date={date} minimumDate={minimumDate} maximumDate={maximumDate} locale="tr-TR" onCancel={() => setVisible(false)} onConfirm={selected => { setVisible(false); onChange(formatLocalDateKey(selected)); }} /></>}
    {optional && !!value && <TouchableOpacity accessibilityRole="button" onPress={() => onChange('')} style={ui.clearDate}><Text style={ui.hint}>Tarihi kaldır</Text></TouchableOpacity>}
  </View>;
}

export function SalarySection({ number, title, subtitle, children }: { number: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return <SalaryPanel style={ui.formSection}><View style={ui.sectionHeading}><Text style={ui.step}>{number}</Text><View style={ui.flex}><Text style={ui.sectionTitle}>{title}</Text>{subtitle && <Text style={ui.hint}>{subtitle}</Text>}</View></View>{children}</SalaryPanel>;
}

export function SalaryResult({ label, amount, hint, negative, children }: { label: string; amount: string; hint?: string; negative?: boolean; children?: React.ReactNode }) {
  return <SalaryPanel tone={negative ? 'danger' : 'cyan'} style={ui.result}><View style={ui.resultTop}><Text style={ui.eyebrow}>{label}</Text><MaterialCommunityIcons name={negative ? 'alert-circle-outline' : 'check-decagram-outline'} size={20} color={negative ? SalaryColors.danger : SalaryColors.cyan} /></View>
    <Text adjustsFontSizeToFit numberOfLines={1} style={[ui.resultAmount, negative && { color: SalaryColors.danger }]}>{amount}</Text>{hint && <Text style={ui.hint}>{hint}</Text>}{children}
  </SalaryPanel>;
}

export function SalaryGauge({ ratio, negative }: { ratio: number | null; negative: boolean }) {
  const progress = ratio === null ? 1 : Math.max(0, Math.min(1, ratio));
  const percent = ratio === null ? null : Math.round(Math.max(0, ratio) * 100);
  const circumference = 2 * Math.PI * 37;
  return <View accessible accessibilityLabel={percent === null ? 'Henüz kazanç yok; gider ayrıldı' : `Maaşın yüzde ${percent} kadarı giderlere ayrıldı`} style={ui.gauge}>
    <Svg width="88" height="88" viewBox="0 0 88 88"><Circle cx="44" cy="44" r="37" stroke="#FFFFFF12" strokeWidth="5" fill="none" /><Circle cx="44" cy="44" r="29" stroke="#FFFFFF0D" strokeWidth="1" fill="none" />
      {progress > 0 && <Circle cx="44" cy="44" r="37" stroke={negative ? SalaryColors.danger : SalaryColors.cyan} strokeWidth="5" strokeLinecap="round" fill="none" strokeDasharray={`${circumference * progress} ${circumference}`} transform="rotate(-90 44 44)" />}</Svg>
    <View style={ui.gaugeLabel}><Text numberOfLines={1} adjustsFontSizeToFit style={ui.gaugeValue}>{percent === null ? '—' : `${percent}%`}</Text><Text style={ui.gaugeCaption}>ayrıldı</Text></View>
  </View>;
}

export const ui = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  panel: { backgroundColor: SalaryColors.surface, borderWidth: 1, borderColor: SalaryColors.border, borderRadius: 22, padding: 18, overflow: 'hidden' },
  iconTile: { borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 52, paddingHorizontal: 17, paddingVertical: 13, borderRadius: 16, backgroundColor: '#6B50D9', borderWidth: 1, borderColor: '#B2A2FF66', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  secondaryButton: { backgroundColor: SalaryColors.inset, borderColor: SalaryColors.border },
  dangerButton: { backgroundColor: '#692B44', borderColor: '#FF869844' },
  buttonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#FFFFFF', flexShrink: 1 },
  disabled: { opacity: 0.45 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#AA9BFF26', backgroundColor: '#AA9BFF0B', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, borderWidth: 1, borderColor: SalaryColors.border, backgroundColor: SalaryColors.inset },
  selectedChip: { backgroundColor: '#AA9BFF1C', borderColor: '#AA9BFF77' },
  chipText: { color: SalaryColors.muted, fontFamily: 'Poppins_500Medium', fontSize: 11 },
  field: { marginBottom: 14 },
  label: { fontFamily: 'Poppins_500Medium', fontSize: 11, lineHeight: 19, color: SalaryColors.muted, marginBottom: 7 },
  inputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#3C4561', backgroundColor: SalaryColors.inset },
  inputFocused: { borderColor: SalaryColors.cyan, backgroundColor: '#142530' },
  input: { flex: 1, minWidth: 0, padding: 0, color: SalaryColors.text, fontFamily: 'Poppins_500Medium', fontSize: 15, outlineWidth: 0 },
  inputLarge: { minHeight: 80 },
  largeInput: { fontSize: 29, fontFamily: 'Poppins_600SemiBold' },
  unit: { color: SalaryColors.purple, fontFamily: 'Poppins_500Medium', fontSize: 11 },
  dateText: { flex: 1, color: SalaryColors.text, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  clearDate: { alignSelf: 'flex-start', paddingVertical: 10 },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 19, color: SalaryColors.muted },
  eyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.5, color: SalaryColors.cyan },
  formSection: { marginBottom: 16 },
  sectionHeading: { flexDirection: 'row', gap: 11, alignItems: 'center', marginBottom: 20 },
  step: { overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', width: 30, height: 30, lineHeight: 30, borderRadius: 9, backgroundColor: '#AA9BFF18', color: SalaryColors.purple, fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SalaryColors.text },
  result: { padding: 20, marginBottom: 16 },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  resultAmount: { fontFamily: 'Poppins_700Bold', fontSize: 33, color: SalaryColors.cyan, marginTop: 14, marginBottom: 5 },
  gauge: { width: 88, height: 88, position: 'relative' },
  gaugeLabel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  gaugeValue: { fontFamily: 'Poppins_600SemiBold', color: SalaryColors.text, fontSize: 17 },
  gaugeCaption: { fontFamily: 'Poppins_400Regular', color: SalaryColors.muted, fontSize: 9 },
});