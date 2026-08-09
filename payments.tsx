import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, Alert
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { PaymentCard } from '../../src/components/PaymentCard';
import {
  getPaymentsByDate, getMarkedDates, updatePaymentStatus, deletePayment
} from '../../src/db/database';
import { getTodayString } from '../../src/utils/helpers';
import { Payment } from '../../src/constants/types';

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
  today: 'Bugün',
};
LocaleConfig.defaultLocale = 'tr';

export default function PaymentsScreen() {
  const today = getTodayString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [currentMonth, setCurrentMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });

  const loadPayments = async () => {
    const [dayPayments, marks] = await Promise.all([
      getPaymentsByDate(selectedDate),
      getMarkedDates(currentMonth.year, currentMonth.month),
    ]);
    setPayments(dayPayments);
    setMarkedDates({
      ...marks,
      [selectedDate]: {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: Colors.primary,
      },
    });
  };

  useFocusEffect(useCallback(() => { loadPayments(); }, [selectedDate, currentMonth]));

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const handleMonthChange = (month: any) => {
    setCurrentMonth({ year: month.year, month: month.month });
  };

  const handleMarkPaid = async (id: number) => {
    await updatePaymentStatus(id, 'paid');
    await loadPayments();
  };

  const handleDelete = async (id: number) => {
    await deletePayment(id);
    await loadPayments();
  };

  const selectedDateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ödemeler</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/payment/add')}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Calendar */}
      <Calendar
        current={today}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          backgroundColor: Colors.background,
          calendarBackground: Colors.surface,
          textSectionTitleColor: Colors.textMuted,
          selectedDayBackgroundColor: Colors.primary,
          selectedDayTextColor: '#fff',
          todayTextColor: Colors.primary,
          dayTextColor: Colors.textPrimary,
          textDisabledColor: Colors.textMuted,
          dotColor: Colors.primary,
          selectedDotColor: '#fff',
          arrowColor: Colors.primary,
          monthTextColor: Colors.textPrimary,
          indicatorColor: Colors.primary,
          textDayFontFamily: 'Poppins_400Regular',
          textMonthFontFamily: 'Poppins_700Bold',
          textDayHeaderFontFamily: 'Poppins_500Medium',
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        style={styles.calendar}
      />

      {/* Selected day header */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{selectedDateFormatted}</Text>
        <Text style={styles.dayCount}>
          {payments.length} ödeme
        </Text>
      </View>

      {/* Payments list */}
      <FlatList
        data={payments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PaymentCard
            payment={item}
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
            onPress={(p) => router.push(`/payment/${p.id}`)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Bu günde ödeme yok</Text>
            <Text style={styles.emptySubtitle}>Yeni ödeme eklemek için + butonuna dokunun</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/payment/add')}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendar: {
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  dayTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  dayCount: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.primary,
  },
});
