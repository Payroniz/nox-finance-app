import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SubscriptionCategory } from '../constants/types';
import { Colors } from '../constants/theme';
import { deleteSubscriptionCategory, saveSubscriptionCategory } from '../db/database';

export function SubscriptionCategories({ categories, onChange }: {
  categories: SubscriptionCategory[]; onChange: (selectedId?: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<number>();
  const [deleting, setDeleting] = useState<number>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const id = await saveSubscriptionCategory(name, editing);
      await onChange(id); setName(''); setEditing(undefined);
    } catch (error) {
      setError(error instanceof Error && error.message === 'DUPLICATE_CATEGORY' ? 'Bu isimde bir kategori zaten var.'
        : !name.trim() ? 'Bir kategori adı girin.' : 'Kategori kaydedilemedi. Yeniden deneyin.');
    } finally { busyRef.current = false; setBusy(false); }
  };
  const remove = async (id: number) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await deleteSubscriptionCategory(id); await onChange(); setDeleting(undefined);
      if (editing === id) { setEditing(undefined); setName(''); }
    } catch { setError('Kategori silinemedi. Yeniden deneyin.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <View style={styles.panel}>
    <Text style={styles.title}>{editing ? 'Kategoriyi yeniden adlandır' : 'Yeni kategori oluştur'}</Text>
    <View style={styles.row}>
      <TextInput accessibilityLabel="Kategori adı" value={name} onChangeText={setName} maxLength={40} editable={!busy}
        placeholder="Örn. Eğlence, İş, Eğitim" placeholderTextColor={Colors.textMuted} style={styles.input} onSubmitEditing={() => void save()} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Kategoriyi kaydet" disabled={busy} onPress={() => void save()} style={styles.save}>
        {busy ? <ActivityIndicator color="white" /> : <MaterialCommunityIcons name={editing ? 'check' : 'plus'} size={23} color="white" />}
      </TouchableOpacity>
    </View>
    {editing !== undefined && <TouchableOpacity disabled={busy} onPress={() => { setEditing(undefined); setName(''); }} style={styles.cancel}><Text style={styles.muted}>Düzenlemekten vazgeç</Text></TouchableOpacity>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {categories.map(category => <View key={category.id}>
      <View style={styles.categoryRow}>
        <MaterialCommunityIcons name="tag-outline" size={18} color={Colors.primaryLight} />
        <Text style={[styles.text, styles.flex]}>{category.name}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${category.name} kategorisini yeniden adlandır`} disabled={busy} style={styles.action}
          onPress={() => { setEditing(category.id); setName(category.name); setError(''); }}><MaterialCommunityIcons name="pencil-outline" size={19} color={Colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${category.name} kategorisini sil`} disabled={busy} style={styles.action}
          onPress={() => setDeleting(category.id)}><MaterialCommunityIcons name="trash-can-outline" size={19} color={Colors.danger} /></TouchableOpacity>
      </View>
      {deleting === category.id && <View style={styles.confirm}>
        <Text style={styles.muted}>Kategori silinsin mi? Aboneliklerin korunur ve Kategorisiz bölümüne taşınır.</Text>
        <View style={styles.row}>
          <TouchableOpacity disabled={busy} style={styles.cancel} onPress={() => setDeleting(undefined)}><Text style={styles.text}>Vazgeç</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy} style={styles.cancel} onPress={() => void remove(category.id)}><Text style={styles.error}>Kategoriyi sil</Text></TouchableOpacity>
        </View>
      </View>}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, gap: 8, marginVertical: 8, borderWidth: 1, borderColor: Colors.surfaceBorder },
  title: { color: Colors.textPrimary, fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: Colors.background, color: Colors.textPrimary, fontFamily: 'Poppins_400Regular', fontSize: 13 },
  save: { width: 48, height: 48, backgroundColor: Colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, paddingTop: 4 },
  flex: { flex: 1 },
  text: { color: Colors.textPrimary, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  muted: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 12 },
  error: { color: Colors.danger, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  confirm: { padding: 10, backgroundColor: Colors.background, borderRadius: 12 },
});