import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../src/constants/theme';
import { DebtCard } from '../../src/components/DebtCard';
import { getDebts } from '../../src/db/database';
import { formatCurrency } from '../../src/utils/helpers';
import { Debt } from '../../src/constants/types';

const PAGE_SIZE = 5;

export default function DebtsScreen() {
  const [activeTab, setActiveTab] = useState<'owe' | 'owed'>('owe');
  const [oweDebts, setOweDebts] = useState<Debt[]>([]);
  const [owedDebts, setOwedDebts] = useState<Debt[]>([]);
  const [owePage, setOwePage] = useState(1);
  const [owedPage, setOwedPage] = useState(1);

  useFocusEffect(useCallback(() => {
    loadDebts();
  }, []));

  const loadDebts = async () => {
    const [owe, owed] = await Promise.all([
      getDebts('owe'),
      getDebts('owed'),
    ]);
    setOweDebts(owe);
    setOwedDebts(owed);
    setOwePage(1);
    setOwedPage(1);
  };

  const currentDebts = activeTab === 'owe' ? oweDebts : owedDebts;
  const currentPage = activeTab === 'owe' ? owePage : owedPage;
  const setCurrentPage = activeTab === 'owe' ? setOwePage : setOwedPage;

  const totalPages = Math.max(1, Math.ceil(currentDebts.length / PAGE_SIZE));
  const pagedDebts = currentDebts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalOwe = oweDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);
  const totalOwed = owedDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);
  const netPosition = totalOwed - totalOwe;
  const totalPrincipal = [...oweDebts, ...owedDebts].reduce((s, d) => s + d.total_amount, 0);
  const totalPaid = [...oweDebts, ...owedDebts].reduce((s, d) => s + d.paid_amount, 0);
  const settlementRate = totalPrincipal ? Math.round((totalPaid / totalPrincipal) * 100) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Borçlar</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/debt/add')}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.netHero}>
        <View style={styles.netHeroTop}>
          <View>
            <Text style={styles.netEyebrow}>NET BORÇ POZİSYONU</Text>
            <Text style={[styles.netValue, { color: netPosition >= 0 ? Colors.success : Colors.danger }]}>
              {netPosition >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netPosition), 'TRY')}
            </Text>
          </View>
          <View style={styles.settlementBadge}>
            <Text style={styles.settlementValue}>%{settlementRate}</Text>
            <Text style={styles.settlementLabel}>kapatıldı</Text>
          </View>
        </View>
        <View style={styles.netTrack}><View style={[styles.netFill, { width: `${settlementRate}%` }]} /></View>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: Colors.danger }]}>
          <MaterialCommunityIcons name="arrow-up-circle" size={24} color={Colors.danger} />
          <Text style={styles.summaryLabel}>Borcum</Text>
          <Text style={[styles.summaryAmount, { color: Colors.danger }]}>
            {formatCurrency(totalOwe, 'TRY')}
          </Text>
          <Text style={styles.summaryCount}>{oweDebts.length} kişi</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: Colors.success }]}>
          <MaterialCommunityIcons name="arrow-down-circle" size={24} color={Colors.success} />
          <Text style={styles.summaryLabel}>Alacağım</Text>
          <Text style={[styles.summaryAmount, { color: Colors.success }]}>
            {formatCurrency(totalOwed, 'TRY')}
          </Text>
          <Text style={styles.summaryCount}>{owedDebts.length} kişi</Text>
        </View>
      </View>

      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'owe' && styles.tabActive]}
          onPress={() => setActiveTab('owe')}
        >
          <Text style={[styles.tabText, activeTab === 'owe' && styles.tabTextActive]}>
            Borcum ({oweDebts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'owed' && styles.tabActive]}
          onPress={() => setActiveTab('owed')}
        >
          <Text style={[styles.tabText, activeTab === 'owed' && styles.tabTextActive]}>
            Alacağım ({owedDebts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Debt list */}
      <FlatList
        data={pagedDebts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <DebtCard
            debt={item}
            onPress={(d) => router.push(`/debt/${d.id}`)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={activeTab === 'owe' ? 'hand-coin' : 'hand-coin-outline'}
              size={56}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'owe' ? 'Borcunuz yok' : 'Alacağınız yok'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'owe'
                ? 'Harika! Kimseye borcunuz yok.'
                : 'Kimse size borçlu değil.'}
            </Text>
          </View>
        )}
        ListFooterComponent={currentDebts.length > 0 ? (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <MaterialCommunityIcons name="chevron-left" size={18} color={currentPage === 1 ? Colors.textMuted : Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.pageLabel}>{currentPage}/{totalPages}</Text>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <MaterialCommunityIcons name="chevron-right" size={18} color={currentPage === totalPages ? Colors.textMuted : Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ) : null}
        showsVerticalScrollIndicator={false}
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
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  netHero: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: Spacing.lg, borderRadius: BorderRadius.xl, backgroundColor: '#312D72', ...Shadow.primary },
  netHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  netEyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.3, color: Colors.primaryLight },
  netValue: { fontFamily: 'Poppins_800ExtraBold', fontSize: FontSize.xxl, marginTop: 3 },
  settlementBadge: { width: 70, height: 58, borderRadius: BorderRadius.lg, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  settlementValue: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.md, color: '#fff' },
  settlementLabel: { fontFamily: 'Poppins_400Regular', fontSize: 8, color: Colors.textSecondary },
  netTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  netFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.success },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  summaryLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  summaryAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.lg,
  },
  summaryCount: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
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
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
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
