import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { palette } from '../lib/tw';

interface DropdownOption {
  value: string;
  label: string;
}

interface TDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  onCustomChange?: (value: string) => void;
}

export default function TDropdown({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select an option',
  allowCustom = false,
  onCustomChange,
}: TDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue);
    setIsOpen(false);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onSelect('other');
      onCustomChange?.(customValue.trim());
      setCustomValue('');
      setIsOpen(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dropdown} onPress={() => setIsOpen(true)}>
        <Text style={[styles.selectedText, !selectedOption && styles.placeholderText]}>
          {displayValue}
        </Text>
        <FontAwesome5 name="chevron-down" size={12} color={palette.text} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <View style={styles.modalContent}>
            <ScrollView style={styles.optionsList}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.option, value === option.value && styles.selectedOption]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text style={[styles.optionText, value === option.value && styles.selectedOptionText]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectedText: {
    fontSize: 16,
    color: palette.text,
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '70%',
    minWidth: '80%',
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedOption: {
    backgroundColor: palette.accent,
  },
  optionText: {
    fontSize: 16,
    color: palette.text,
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
});
