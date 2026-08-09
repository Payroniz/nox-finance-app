import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/theme';

interface CurrencyInputProps {
  value: string; // e.g. "1500.50"
  onChange: (val: string) => void;
  symbol?: string;
  style?: object;
}

/**
 * Lira ve kuruş ayrı giriş kutusu.
 * value: "1500.50" formatında string
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, symbol = '₺', style }) => {
  const kurusRef = useRef<TextInput>(null);
  const liraRef = useRef<TextInput>(null);

  // value örn: "1500.50" → lira="1500" kurus="50"
  const parts = value.split('.');
  const liraStr = parts[0] || '';
  const kurusStr = parts[1] !== undefined ? parts[1] : '';

  const handleLiraChange = (text: string) => {
    // Sadece rakam kabul et
    const clean = text.replace(/\D/g, '');
    onChange(clean + (kurusStr !== '' ? '.' + kurusStr : ''));
    // Kuruşa atla
    if (text.endsWith('.') || text.endsWith(',')) {
      kurusRef.current?.focus();
    }
  };

  const handleKurusChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 2);
    onChange(liraStr + '.' + clean);
  };

  // Görüntüleme için lira kısmını binlik ayır
  const formattedLira = liraStr
    ? parseInt(liraStr, 10).toLocaleString('tr-TR')
    : '';

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.symbol}>{symbol}</Text>
      <TextInput
        ref={liraRef}
        style={styles.liraInput}
        value={formattedLira}
        onChangeText={(t) => {
          // binlik ayraçları temizleyip işle
          const raw = t.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '');
          onChange(raw + (kurusStr !== '' ? '.' + kurusStr : ''));
          if (t.endsWith('.') || t.endsWith(',')) kurusRef.current?.focus();
        }}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        returnKeyType="next"
        onSubmitEditing={() => kurusRef.current?.focus()}
      />
      <Text style={styles.separator}>,</Text>
      <TextInput
        ref={kurusRef}
        style={styles.kurusInput}
        value={kurusStr}
        onChangeText={handleKurusChange}
        keyboardType="number-pad"
        placeholder="00"
        placeholderTextColor={Colors.textMuted}
        maxLength={2}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  symbol: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.primary,
    marginRight: 4,
  },
  liraInput: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    padding: 0,
    minWidth: 40,
  },
  separator: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginHorizontal: 2,
  },
  kurusInput: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    padding: 0,
    width: 36,
    textAlign: 'right',
  },
});
