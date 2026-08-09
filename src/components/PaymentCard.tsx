import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, PanResponder, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Payment } from '../constants/types';
import { Colors, BorderRadius, Spacing, FontSize, FontWeight, Shadow } from '../constants/theme';
import { formatCurrency, formatDateWithTime, getStatusColor, getStatusLabel, getStatusIcon, getRecurrenceLabel, getTimeRemaining } from '../utils/helpers';

interface PaymentCardProps {
  payment: Payment;
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
  onPress: (payment: Payment) => void;
}

const SWIPE_THRESHOLD = 80;

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment, onMarkPaid, onDelete, onPress
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const statusColor = getStatusColor(payment.status);
  const statusLabel = getStatusLabel(payment.status);
  const statusIcon = getStatusIcon(payment.status) as any;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD && payment.status !== 'paid') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onMarkPaid(payment.id);
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Ödemeyi Sil',
            `"${payment.name}" ödemesini silmek istiyor musunuz?`,
            [
              { text: 'İptal', onPress: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start() },
              { text: 'Sil', style: 'destructive', onPress: () => onDelete(payment.id) },
            ]
          );
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const getCategoryIcon = (): any => {
    switch (payment.icon_type) {
      case 'icon': return payment.icon_value || 'cash';
      default: return 'cash';
    }
  };

  const recurrenceLabel = getRecurrenceLabel(payment.recurrence);
  const timeRemaining = payment.status !== 'paid' ? getTimeRemaining(payment.due_date, payment.due_time) : null;
  const categoryLine = payment.recurrence && payment.recurrence !== 'once'
    ? `${payment.category} - ${recurrenceLabel}`
    : payment.category;

  return (
    <View style={styles.wrapper}>
      {/* Background actions */}
      <View style={styles.actionsContainer}>
        <View style={[styles.actionLeft, styles.actionPaid]}>
          <MaterialCommunityIcons name="check" size={24} color="#fff" />
          <Text style={styles.actionText}>Ödendi</Text>
        </View>
        <View style={[styles.actionRight, styles.actionDelete]}>
          <MaterialCommunityIcons name="delete" size={24} color="#fff" />
          <Text style={styles.actionText}>Sil</Text>
        </View>
      </View>

      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => onPress(payment)}
          activeOpacity={0.8}
          style={styles.cardInner}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${statusColor}20` }]}>
            {payment.icon_type === 'emoji' ? (
              <Text style={styles.emojiIcon}>{payment.icon_value}</Text>
            ) : payment.icon_type === 'gallery' ? (
              <Image source={{ uri: payment.icon_value }} style={styles.galleryIcon} />
            ) : (
              <MaterialCommunityIcons
                name={getCategoryIcon()}
                size={24}
                color={statusColor}
              />
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.name} numberOfLines={1}>{payment.name}</Text>
            <Text style={styles.category}>{categoryLine}</Text>
            <Text style={styles.date}>
              {formatDateWithTime(payment.due_date, payment.due_time)}
              {timeRemaining ? ` (${timeRemaining})` : ''}
            </Text>
          </View>

          {/* Amount & Status */}
          <View style={styles.rightContainer}>
            <Text style={[styles.amount, { color: statusColor }]}>
              {formatCurrency(payment.amount, payment.currency)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <MaterialCommunityIcons name={statusIcon} size={12} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  actionsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  actionLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionPaid: {
    backgroundColor: Colors.success,
  },
  actionDelete: {
    backgroundColor: Colors.danger,
  },
  actionText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadow.sm,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: {
    fontSize: 24,
  },
  galleryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  infoContainer: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  category: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  date: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rightContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.xs,
  },
});
