// components/ExtractionReviewDrawer.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { palette } from '../lib/tw';
import TInput from './TInput';
import TChip from './TChip';

interface ExtractedData {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  notes?: string;
  type?: 'walk' | 'run' | 'cycle' | 'strength' | 'yoga' | 'pilates' | 'swim' | 'crossfit' | 'hyrox' | 'horse' | 'other';
  duration_min?: number;
  distance_km?: number;
  intensity?: 'easy' | 'moderate' | 'hard';
}

interface ExtractionReviewDrawerProps {
  visible: boolean;
  extracted: ExtractedData;
  category: 'nutrition' | 'exercise';
  onApply: (data: any) => void;
  onCancel: () => void;
  onFieldChange: (field: string, value: any) => void;
}

const EXERCISE_TYPES = ['walk', 'run', 'cycle', 'strength', 'yoga', 'pilates', 'swim', 'crossfit', 'hyrox', 'horse', 'other'];
const INTENSITIES = ['easy', 'moderate', 'hard'];

export default function ExtractionReviewDrawer({
  visible,
  extracted,
  category,
  onApply,
  onCancel,
  onFieldChange
}: ExtractionReviewDrawerProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.drawer}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Extracted Data</Text>
          <Pressable onPress={onCancel} style={styles.closeButton}>
            <FontAwesome5 name="times" size={18} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.subtitle}>
            Review and edit the data extracted by AI:
          </Text>

          {category === 'nutrition' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutrition Data</Text>
              
              <TInput
                placeholder="Calories"
                value={extracted.calories?.toString() || ''}
                onChangeText={(value) => onFieldChange('calories', value)}
                keyboardType="numeric"
              />
              
              <TInput
                placeholder="Protein (g)"
                value={extracted.protein_g?.toString() || ''}
                onChangeText={(value) => onFieldChange('protein_g', value)}
                keyboardType="numeric"
              />
              
              <TInput
                placeholder="Carbs (g)"
                value={extracted.carbs_g?.toString() || ''}
                onChangeText={(value) => onFieldChange('carbs_g', value)}
                keyboardType="numeric"
              />
              
              <TInput
                placeholder="Fat (g)"
                value={extracted.fat_g?.toString() || ''}
                onChangeText={(value) => onFieldChange('fat_g', value)}
                keyboardType="numeric"
              />
            </View>
          )}

          {category === 'exercise' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exercise Data</Text>
              
              <Text style={styles.label}>Exercise Type</Text>
              <View style={styles.chipRow}>
                {EXERCISE_TYPES.map((type) => (
                  <TChip
                    key={type}
                    label={type}
                    selected={extracted.type === type}
                    onPress={() => onFieldChange('type', type)}
                  />
                ))}
              </View>

              <TInput
                placeholder="Duration (minutes)"
                value={extracted.duration_min?.toString() || ''}
                onChangeText={(value) => onFieldChange('duration_min', value)}
                keyboardType="numeric"
              />

              {['walk', 'run', 'cycle'].includes(extracted.type || '') && (
                <TInput
                  placeholder="Distance (km)"
                  value={extracted.distance_km?.toString() || ''}
                  onChangeText={(value) => onFieldChange('distance_km', value)}
                  keyboardType="numeric"
                />
              )}

              <Text style={styles.label}>Intensity</Text>
              <View style={styles.chipRow}>
                {INTENSITIES.map((intensity) => (
                  <TChip
                    key={intensity}
                    label={intensity}
                    selected={extracted.intensity === intensity}
                    onPress={() => onFieldChange('intensity', intensity)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <TInput
              placeholder="Notes (optional)"
              value={extracted.notes || ''}
              onChangeText={(value) => onFieldChange('notes', value)}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.applyButton]} onPress={onApply}>
            <Text style={styles.applyButtonText}>Apply to Form</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: palette.text,
    marginBottom: 20,
    opacity: 0.8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 8,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  applyButton: {
    backgroundColor: palette.accent,
  },
  cancelButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
