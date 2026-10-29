import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { formatDate } from '../../utils/helpers';
import { SalaryExpenseRange, isSalaryDate, salaryMonthRange } from '../../utils/salary';
import { SalaryChip, SalaryColors, SalaryDateField, SalaryIconButton, ui } from './SalaryUI';

export function SalaryRangePicker({ salaryMonth, value, onChange, custom, onCustomChange }: { salaryMonth: string; value: SalaryExpenseRange; onChange: (value: SalaryExpenseRange) => void; custom: boolean; onCustomChange: (value: boolean) => void }) {
  const choose = (offset: number) => { onChange({ ...salaryMonthRange(salaryMonth, offset), includeEarlier: value.includeEarlier }); onCustomChange(false); };
  const move = (offset: number) => {
    if (!isSalaryDate(value.start)) return;
    try { onChange({ ...salaryMonthRange(value.start.slice(0, 7), offset), includeEarlier: value.includeEarlier }); onCustomChange(false); } catch { /* At the supported year boundary. */ }
  };
  const isCurrent = !custom && value.start === `${salaryMonth}-01`;
  let nextStart = '';
  try { nextStart = salaryMonthRange(salaryMonth, 1).start; } catch { /* Last supported month. */ }
  return <>
    <View style={styles.chips}>
      <SalaryChip label="Maaş ayı" selected={isCurrent} onPress={() => choose(0)} icon="calendar-blank-outline" />
      {!!nextStart && <SalaryChip label="Sonraki ay" selected={!custom && value.start === nextStart} onPress={() => choose(1)} icon="calendar-arrow-right" />}
      <SalaryChip label="Özel aralık" selected={custom} onPress={() => onCustomChange(true)} icon="calendar-range" />
    </View>
    {custom ? <View><SalaryDateField label="Gider başlangıcı" value={value.start} onChange={start => onChange({ ...value, start })} />
      <SalaryDateField label="Gider bitişi" value={value.end} onChange={end => onChange({ ...value, end })} /><Text style={[ui.hint, styles.limit]}>Başlangıç ve bitiş dahil, en fazla 366 gün.</Text></View>
      : <View style={styles.month}><SalaryIconButton icon="chevron-left" label="Önceki gider ayı" disabled={value.start === '1900-01-01'} onPress={() => move(-1)} />
        <View style={styles.monthLabel}><Text style={ui.eyebrow}>GİDER DÖNEMİ</Text><Text style={styles.monthTitle}>{formatDate(value.start, 'MMMM yyyy')}</Text></View>
        <SalaryIconButton icon="chevron-right" label="Sonraki gider ayı" disabled={value.start.slice(0, 7) === '2199-12'} onPress={() => move(1)} /></View>}
    <View style={styles.toggle}><View style={ui.flex}><Text style={styles.toggleTitle}>Önceki vadeleri de göster</Text><Text style={ui.hint}>Bekleyen ödemeler ve borçlar</Text></View><Switch accessibilityLabel="Önceki vadeleri de göster" value={value.includeEarlier} onValueChange={includeEarlier => onChange({ ...value, includeEarlier })} trackColor={{ false: '#343D57', true: '#6854BA' }} thumbColor={value.includeEarlier ? SalaryColors.cyan : '#A4AEC8'} /></View>
    <Text style={ui.hint}>Vadesiz borçlar her dönemde gösterilir. Maaş ayın değişmez.</Text>
  </>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  month: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, backgroundColor: SalaryColors.inset, borderRadius: 16, marginBottom: 12 },
  monthLabel: { flex: 1, alignItems: 'center', gap: 5 },
  monthTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SalaryColors.text, textTransform: 'capitalize' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  toggleTitle: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: SalaryColors.text },
  limit: { marginTop: -10 },
});