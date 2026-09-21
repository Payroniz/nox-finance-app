import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Currency } from '../constants/types';
import { Colors } from '../constants/theme';

export const CurrencySelector = ({ value, onChange }: { value: Currency; onChange: (value: Currency) => void }) => (
  <View style={styles.row}>
    {(['TRY', 'USD', 'EUR', 'GBP'] as const).map(unit => <TouchableOpacity key={unit} accessibilityRole="button"
      accessibilityLabel={`${unit} hesaplarını göster`} accessibilityState={{ selected: value === unit }}
      onPress={() => onChange(unit)} style={[styles.button, value === unit && { backgroundColor: Colors.primary }]}>
      <Text style={[styles.text, value === unit && { color: '#fff' }]}>{unit}</Text>
    </TouchableOpacity>)}
  </View>
);
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderRadius: 12 },
  text: { color: Colors.textSecondary, fontFamily: 'Poppins_500Medium', fontSize: 12 },
});
