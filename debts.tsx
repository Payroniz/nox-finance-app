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

export default function DebtsScreen() {
  const [activeTab, setActiveTab] = useState<'owe' | 'owed'>('owe');
  const [oweDebts, setOweDebts] = useState<Debt[]>([]);
  const [owedDebts, setOwedDebts] = useState<Debt[]>([]);

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
  };

  const currentDebts = activeTab === 'owe' ? oweDebts : owedDebts;
  const totalOwe = oweDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);
  const totalOwed = owedDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);

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
        data={currentDebts}
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
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/debt/add')}
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
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
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
    paddingBottom: 100,
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
