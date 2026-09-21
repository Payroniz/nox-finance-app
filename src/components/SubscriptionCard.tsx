import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SubscriptionInput } from '../constants/types';
import { getContrastColor, normalizeHexColor } from '../utils/colors';
import { formatCurrency, formatDate } from '../utils/helpers';
import { DEFAULT_SUBSCRIPTION_COLOR, getNextRenewal, SUBSCRIPTION_CYCLES } from '../utils/subscriptions';

export const SubscriptionIcon = ({ item, size = 28, color }: {
  item: Pick<SubscriptionInput, 'icon_type' | 'icon_value'>; size?: number; color: string;
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.icon_value]);
  if (item.icon_type === 'gallery' && item.icon_value && !failed) {
    return <Image source={{ uri: item.icon_value }} style={{ width: size + 10, height: size + 10, borderRadius: 10 }} resizeMode="contain" onError={() => setFailed(true)} />;
  }
  if (item.icon_type === 'emoji') return <Text style={{ fontSize: size }}>{item.icon_value}</Text>;
  const icon = item.icon_value in MaterialCommunityIcons.glyphMap ? item.icon_value : 'repeat';
  return <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={color} />;
};

type Props = { item: SubscriptionInput; date?: string; onPress?: () => void; onEdit?: () => void; onDelete?: () => void; disabled?: boolean; preview?: boolean };

export const SubscriptionCard = ({ item, date, onPress, onEdit, onDelete, disabled, preview }: Props) => {
  const background = normalizeHexColor(item.color) ?? DEFAULT_SUBSCRIPTION_COLOR;
  const foreground = getContrastColor(background);
  const text = { color: foreground };
  const line = `${foreground}30`;
  const content = <>
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: `${foreground}14` }]}><SubscriptionIcon item={item} color={foreground} /></View>
      <View style={styles.flex}>
        <Text style={[styles.title, text]}>{item.name || 'Abonelik adı'}</Text>
        <Text style={[styles.detail, text]}>{SUBSCRIPTION_CYCLES[item.billing_cycle]} • {item.active ? 'Aktif' : 'Pasif'}</Text>
      </View>
      {preview && <Text style={[styles.detail, text]}>Önizleme</Text>}
    </View>
    <Text style={[styles.amount, text]}>{formatCurrency(item.amount, item.currency)} <Text style={styles.detail}>/ {SUBSCRIPTION_CYCLES[item.billing_cycle].toLocaleLowerCase('tr-TR')}</Text></Text>
    <Text style={[styles.detail, text]}>{!item.active ? 'Takip duraklatıldı' : `${date ? 'Yenileme' : 'Sonraki yenileme'}: ${formatDate(date ?? getNextRenewal(item))}`}</Text>
    {!!item.notes && <Text style={[styles.notes, text]} numberOfLines={2}>{item.notes}</Text>}
    {(onEdit || onDelete) && <View style={[styles.actions, { borderTopColor: line }]}>
      {onEdit && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.name} düzenle`} disabled={disabled} style={styles.action} onPress={onEdit}><MaterialCommunityIcons name="pencil-outline" size={18} color={foreground} /><Text style={[styles.actionText, text]}>Düzenle</Text></TouchableOpacity>}
      {onDelete && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.name} sil`} disabled={disabled} style={styles.action} onPress={onDelete}><MaterialCommunityIcons name="trash-can-outline" size={18} color={foreground} /><Text style={[styles.actionText, text]}>Sil</Text></TouchableOpacity>}
    </View>}
  </>;
  const style = [styles.card, { backgroundColor: background, borderColor: line }];
  return onPress ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.name} aboneliği`} style={style} onPress={onPress}>{content}</TouchableOpacity>
    : <View testID={preview ? 'subscription-preview' : 'subscription-card'} style={style}>{content}</View>;
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
  detail: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
  amount: { fontFamily: 'Poppins_700Bold', fontSize: 22, marginTop: 14, marginBottom: 4 },
  notes: { fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, borderTopWidth: 1, paddingTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, minHeight: 44 },
  actionText: { fontFamily: 'Poppins_500Medium', fontSize: 12 },
});
