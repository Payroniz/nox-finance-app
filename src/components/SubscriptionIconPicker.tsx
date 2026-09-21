import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { IconType, UploadedIcon } from '../constants/types';
import { Colors } from '../constants/theme';
import { addUploadedIcon, getUploadedIcons } from '../db/database';
import { persistMediaFile } from '../utils/media';

const featured = ['repeat', 'youtube', 'spotify', 'netflix', 'music', 'television', 'cloud', 'gamepad-variant', 'wifi', 'cellphone', 'microsoft', 'apple', 'google', 'play-circle', 'book-open-variant', 'dumbbell'];
const icons = [...new Set([...featured, ...Object.keys(MaterialCommunityIcons.glyphMap).sort()])];
type Props = {
  type: IconType; value: string; uploaded: UploadedIcon[];
  onChange: (type: IconType, value: string) => void;
  onUploaded: (items: UploadedIcon[]) => void;
  onBusyChange: (busy: boolean) => void;
};

export const SubscriptionIconPicker = ({ type, value, uploaded, onChange, onUploaded, onBusyChange }: Props) => {
  const [tab, setTab] = useState<'icon' | 'library'>('icon');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(48);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const uploadRef = useRef(false);
  const filtered = useMemo(() => icons.filter(icon => icon.includes(query.trim().toLowerCase())), [query]);

  const upload = async () => {
    if (uploadRef.current) return;
    uploadRef.current = true; setUploading(true); onBusyChange(true); setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true,
        aspect: [1, 1], quality: 0.8, base64: Platform.OS === 'web' });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) { setError('En fazla 5 MB boyutunda bir görsel seçin.'); return; }
      const uri = Platform.OS === 'web' && asset.base64
        ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
        : await persistMediaFile(asset.uri, 'subscription-icon');
      await addUploadedIcon(uri, asset.fileName || 'Abonelik görseli');
      onUploaded(await getUploadedIcons());
      onChange('gallery', uri); setTab('library');
    } catch { setError('Görsel yüklenemedi. Fotoğraf erişimini kontrol edip yeniden deneyin.'); }
    finally { uploadRef.current = false; setUploading(false); onBusyChange(false); }
  };

  return <View style={styles.container}>
    <View style={styles.tabs}>
      {([['icon', 'Sistem ikonları'], ['library', 'Yüklü ikonlar']] as const).map(([key, label]) => <TouchableOpacity key={key}
        accessibilityRole="button" accessibilityState={{ selected: tab === key }} style={[styles.tab, tab === key && styles.selected]} onPress={() => setTab(key)}>
        <Text style={styles.text}>{label}</Text>
      </TouchableOpacity>)}
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="İkon veya fotoğraf yükle" disabled={uploading} style={styles.upload} onPress={() => void upload()}>
      {uploading ? <ActivityIndicator color={Colors.primaryLight} /> : <MaterialCommunityIcons name="image-plus" size={24} color={Colors.primaryLight} />}
      <Text style={styles.text}>{uploading ? 'Yükleniyor…' : 'İkon / fotoğraf yükle'}</Text>
    </TouchableOpacity>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {tab === 'icon' ? <>
      <TextInput accessibilityLabel="Sistem ikonu ara" style={styles.search} placeholder="İkon ara (music, cloud, game…)" placeholderTextColor={Colors.textMuted}
        autoCapitalize="none" value={query} onChangeText={text => { setQuery(text); setLimit(48); }} />
      <View style={styles.grid}>{filtered.slice(0, limit).map(icon => <TouchableOpacity key={icon} accessibilityRole="button" accessibilityLabel={`${icon} ikonu`}
        accessibilityState={{ selected: type === 'icon' && value === icon }} style={[styles.option, type === 'icon' && value === icon && styles.selected]}
        onPress={() => onChange('icon', icon)}><MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={26} color={Colors.textPrimary} /></TouchableOpacity>)}</View>
      {filtered.length === 0 && <Text style={styles.hint}>Bu aramayla eşleşen ikon yok.</Text>}
      {filtered.length > limit && <TouchableOpacity style={styles.upload} onPress={() => setLimit(current => current + 48)}><Text style={styles.text}>Daha fazla ikon göster</Text></TouchableOpacity>}
    </> : <View style={styles.grid}>
      {uploaded.map(icon => <TouchableOpacity key={icon.id} accessibilityRole="button" accessibilityLabel={icon.name || 'Yüklü ikon'}
        accessibilityState={{ selected: type === 'gallery' && value === icon.uri }} style={[styles.option, type === 'gallery' && value === icon.uri && styles.selected]}
        onPress={() => onChange('gallery', icon.uri)}><Image source={{ uri: icon.uri }} style={styles.image} resizeMode="contain" /></TouchableOpacity>)}
      {!uploaded.length && <Text style={styles.hint}>Henüz görsel yüklenmedi. Yüklediğin görselleri diğer kayıtlarda da kullanabilirsin.</Text>}
    </View>}
  </View>;
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  text: { color: Colors.textPrimary, fontFamily: 'Poppins_500Medium', fontSize: 12 },
  selected: { borderColor: Colors.primaryLight, backgroundColor: `${Colors.primary}35` },
  upload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48, borderRadius: 12, backgroundColor: Colors.surface },
  search: { padding: 12, minHeight: 48, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: 12, backgroundColor: Colors.surface },
  image: { width: 38, height: 38, borderRadius: 8 },
  hint: { color: Colors.textSecondary, fontFamily: 'Poppins_400Regular', fontSize: 12 },
  error: { color: Colors.danger, fontSize: 12 },
});
