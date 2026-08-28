import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, ScrollView
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { PaymentCard } from '../../src/components/PaymentCard';
import {
  getPaymentsByDate, getMarkedDates, updatePaymentStatus, deletePayment, getPayments
} from '../../src/db/database';
import { formatCurrency, getTodayString } from '../../src/utils/helpers';
import { cancelNotification } from '../../src/utils/notifications';
import { Payment } from '../../src/constants/types';

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
  today: 'Bugün',
};
LocaleConfig.defaultLocale = 'tr';

const PAGE_SIZE = 5;

export default function PaymentsScreen() {
  const today = getTodayString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [currentMonth, setCurrentMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allPage, setAllPage] = useState(1);

  const loadPayments = async () => {
    const [dayPayments, marks, all] = await Promise.all([
      getPaymentsByDate(selectedDate),
      getMarkedDates(currentMonth.year, currentMonth.month),
      getPayments(),
    ]);
    setPayments(dayPayments);
    setAllPayments(all);
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

  const handleDayPress = (day: any) => setSelectedDate(day.dateString);
  const handleMonthChange = (month: any) => setCurrentMonth({ year: month.year, month: month.month });

  const handleMarkPaid = async (id: number) => {
    const payment = allPayments.find(item => item.id === id);
    if (payment?.notification_id) await cancelNotification(payment.notification_id);
    await updatePaymentStatus(id, 'paid');
    await loadPayments();
  };

  const handleDelete = async (id: number) => {
    const payment = allPayments.find(item => item.id === id);
    if (payment?.notification_id) await cancelNotification(payment.notification_id);
    await deletePayment(id);
    await loadPayments();
  };

  const selectedDateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const totalAllPages = Math.max(1, Math.ceil(allPayments.length / PAGE_SIZE));
  const pagedPayments = allPayments.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE);
  const pendingPayments = allPayments.filter(item => item.status !== 'paid');
  const pendingTotal = pendingPayments.reduce((sum, item) => sum + item.amount, 0);
  const overdueCount = allPayments.filter(item => item.status === 'overdue').length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ödemeler</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/payment/add')}>
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.commandCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.commandEyebrow}>ÖDEME KONTROL MERKEZİ</Text>
                <Text style={styles.commandAmount}>{formatCurrency(pendingTotal, 'TRY')}</Text>
                <Text style={styles.commandCaption}>bekleyen toplam • {pendingPayments.length} kayıt</Text>
              </View>
              <View style={[styles.riskBubble, { backgroundColor: overdueCount ? `${Colors.danger}22` : `${Colors.success}22` }]}>
                <MaterialCommunityIcons name={overdueCount ? 'alert-decagram' : 'check-decagram'} size={24} color={overdueCount ? Colors.danger : Colors.success} />
                <Text style={[styles.riskValue, { color: overdueCount ? Colors.danger : Colors.success }]}>{overdueCount}</Text>
                <Text style={styles.riskLabel}>gecikmiş</Text>
              </View>
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
              <Text style={styles.dayCount}>{payments.length} ödeme</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <PaymentCard
              payment={item}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDelete}
              onPress={(p) => router.push(`/payment/${p.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Bu günde ödeme yok</Text>
            <Text style={styles.emptySubtitle}>Yeni ödeme eklemek için + butonuna dokunun</Text>
          </View>
        )}
        ListFooterComponent={
          <>
            {/* Divider + Tüm Kayıtlı Ödemeler */}
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
            </View>

            <Text style={styles.allPaymentsTitle}>Tüm Kayıtlı Ödemeler</Text>

            {allPayments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="credit-card-off-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Kayıtlı ödeme yok</Text>
              </View>
            ) : (
              <>
                {pagedPayments.map(item => (
                  <View key={item.id} style={styles.listItem}>
                    <PaymentCard
                      payment={item}
                      onMarkPaid={handleMarkPaid}
                      onDelete={handleDelete}
                      onPress={(p) => router.push(`/payment/${p.id}`)}
                    />
                  </View>
                ))}

                {/* Pagination */}
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageBtn, allPage === 1 && styles.pageBtnDisabled]}
                    onPress={() => setAllPage(p => Math.max(1, p - 1))}
                    disabled={allPage === 1}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={18} color={allPage === 1 ? Colors.textMuted : Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.pageLabel}>{allPage}/{totalAllPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, allPage === totalAllPages && styles.pageBtnDisabled]}
                    onPress={() => setAllPage(p => Math.min(totalAllPages, p + 1))}
                    disabled={allPage === totalAllPages}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={18} color={allPage === totalAllPages ? Colors.textMuted : Colors.primary} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={{ height: 32 }} />
          </>
        }
        contentContainerStyle={styles.listContent}
      />
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
  commandCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: Spacing.lg, borderRadius: BorderRadius.xl, backgroundColor: '#312D72', overflow: 'hidden', ...Shadow.primary },
  commandEyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.3, color: Colors.primaryLight },
  commandAmount: { fontFamily: 'Poppins_800ExtraBold', fontSize: FontSize.xxl, color: '#fff', marginTop: 3 },
  commandCaption: { fontFamily: 'Poppins_400Regular', fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)' },
  riskBubble: { width: 74, height: 74, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  riskValue: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.md, lineHeight: 17 },
  riskLabel: { fontFamily: 'Poppins_400Regular', fontSize: 8, color: Colors.textSecondary },
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
    paddingBottom: Spacing.lg,
  },
  listItem: {
    paddingHorizontal: Spacing.lg,
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
  dividerRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  allPaymentsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
});
