import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Debt } from '../constants/types';
import { Colors, BorderRadius, Spacing, FontSize, Shadow } from '../constants/theme';
import { formatCurrency, formatDate, getDueDateLabel, determineDebtStatus, getDebtStatusColor } from '../utils/helpers';

interface DebtCardProps {
  debt: Debt;
  onPress: (debt: Debt) => void;
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, onPress }) => {
  const status = determineDebtStatus(debt.due_date);
  const statusColor = getDebtStatusColor(status);
  const remaining = debt.total_amount - debt.paid_amount;
  const progress = debt.total_amount > 0 ? debt.paid_amount / debt.total_amount : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(debt)}
      activeOpacity={0.8}
    >
      {/* Left accent */}
      <View style={[styles.accent, { backgroundColor: statusColor }]} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.personInfo}>
            <View style={[styles.avatar, { backgroundColor: `${statusColor}25` }]}>
              {debt.icon_type === 'gallery' && debt.icon_value ? (
                <Image source={{ uri: debt.icon_value }} style={styles.avatarImage} />
              ) : debt.icon_type === 'emoji' ? (
                <Text style={styles.avatarEmoji}>{debt.icon_value}</Text>
              ) : debt.icon_value ? (
                <MaterialCommunityIcons name={debt.icon_value as any} size={23} color={statusColor} />
              ) : (
                <Text style={styles.avatarText}>
                  {debt.person_name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.personName}>{debt.person_name}</Text>
              {debt.due_date ? (
                <Text style={styles.dueDateLabel}>{getDueDateLabel(debt.due_date)}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={[styles.remainingAmount, { color: statusColor }]}>
              {formatCurrency(remaining, debt.currency)}
            </Text>
            <Text style={styles.totalAmount}>
              / {formatCurrency(debt.total_amount, debt.currency)}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: statusColor }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: statusColor }]}>
            %{Math.round(progress * 100)} ödendi
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  accent: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  personName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  dueDateLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  remainingAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.lg,
  },
  totalAmount: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  progressContainer: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
});
