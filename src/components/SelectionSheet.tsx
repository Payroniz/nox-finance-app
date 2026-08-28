import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '../constants/theme';

export type SelectionOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SelectionOption[];
  selectedValues: string[];
  multiple?: boolean;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (values: string[]) => void | Promise<void>;
};

export const SelectionSheet = ({
  visible,
  title,
  subtitle,
  options,
  selectedValues,
  multiple = false,
  confirmLabel = 'Uygula',
  onClose,
  onConfirm,
}: Props) => {
  const [draft, setDraft] = useState<string[]>(selectedValues);

  useEffect(() => {
    if (visible) setDraft(selectedValues);
  }, [visible, selectedValues]);

  const toggle = (value: string) => {
    if (!multiple) {
      setDraft([value]);
      return;
    }
    setDraft(current => current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]);
  };

  const handleConfirm = async () => {
    if (draft.length === 0) return;
    await onConfirm(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={21} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {options.map(option => {
              const selected = draft.includes(option.value);
              const accent = option.color ?? Colors.primary;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, selected && { borderColor: accent, backgroundColor: `${accent}16` }]}
                  activeOpacity={0.78}
                  onPress={() => toggle(option.value)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: `${accent}1F` }]}>
                    <MaterialCommunityIcons
                      name={(option.icon ?? 'circle-outline') as any}
                      size={21}
                      color={accent}
                    />
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
                  </View>
                  <View style={[
                    multiple ? styles.checkbox : styles.radio,
                    selected && { borderColor: accent, backgroundColor: accent },
                  ]}>
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={14} color="#fff" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, draft.length === 0 && styles.confirmDisabled]}
              disabled={draft.length === 0}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 8, 18, 0.72)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.surfaceBorder,
    ...Shadow.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceBorder,
    marginBottom: Spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.lg },
  titleWrap: { flex: 1, paddingRight: Spacing.md },
  title: { fontFamily: 'Poppins_700Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.sm,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.sm },
  option: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceLight,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionTextWrap: { flex: 1, paddingRight: Spacing.sm },
  optionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: Colors.textPrimary },
  optionDescription: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.xs,
    lineHeight: 17,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelButton: {
    flex: 0.8,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  confirmButton: {
    flex: 1.2,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.primary,
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: { fontFamily: 'Poppins_600SemiBold', fontSize: FontSize.md, color: '#fff' },
});
