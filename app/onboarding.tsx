import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../src/constants/theme';
import { setSetting } from '../src/db/database';

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);

  const handleContinue = async () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    await setSetting('userName', name.trim() || 'Kullanıcı');
    await setSetting('onboardingCompleted', 'true');
    router.replace('/(tabs)');
  };

  const steps = [
    {
      icon: 'wallet',
      title: 'NoX\'e Hoş Geldin',
      subtitle: 'Ödemelerini ve borçlarını tek bir yerden kolayca takip et.',
    },
    {
      icon: 'account',
      title: 'Seni Tanıyalım',
      subtitle: 'Adını gir, seni nasıl karşılayalım?',
    },
  ];

  const current = steps[step];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons name={current.icon as any} size={64} color={Colors.primary} />
        </View>

        {/* Text */}
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {/* Name input on step 1 */}
        {step === 1 && (
          <TextInput
            style={styles.input}
            placeholder="Adın nedir?"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        )}

        {/* Step dots */}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      {/* Button */}
      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>
          {step < steps.length - 1 ? 'Devam Et' : 'Başla'}
        </Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingTop: 80,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: FontSize.xxxl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontFamily: 'Poppins_400Regular',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginTop: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceBorder,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    ...Shadow.primary,
  },
  buttonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.lg,
    color: '#fff',
  },
});
