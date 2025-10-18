// components/ProcessingBanner.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { palette } from '../lib/tw';
import { AttachmentStatus } from '../src/lib/attachments';

interface ProcessingBannerProps {
  status: AttachmentStatus;
  error?: string;
  onDismiss?: () => void;
}

export default function ProcessingBanner({ status, error, onDismiss }: ProcessingBannerProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: 'clock' as const,
          text: 'Uploading...',
          color: palette.text,
          showSpinner: false
        };
      case 'processing':
        return {
          icon: 'cog' as const,
          text: 'AI is analyzing your content...',
          color: palette.teal,
          showSpinner: true
        };
      case 'ready':
        return {
          icon: 'check-circle' as const,
          text: 'Analysis complete! Review the extracted data below.',
          color: palette.green,
          showSpinner: false
        };
      case 'error':
        return {
          icon: 'exclamation-triangle' as const,
          text: error || 'Processing failed. Please try again.',
          color: '#ef4444',
          showSpinner: false
        };
      default:
        return {
          icon: 'question-circle' as const,
          text: 'Unknown status',
          color: palette.text,
          showSpinner: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.banner, { borderColor: config.color }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {config.showSpinner ? (
            <ActivityIndicator size="small" color={config.color} />
          ) : (
            <FontAwesome5 name={config.icon} size={16} color={config.color} />
          )}
        </View>
        <Text style={[styles.text, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 20,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
