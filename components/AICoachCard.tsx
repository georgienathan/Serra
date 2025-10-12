// components/AICoachCard.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { palette } from '../lib/tw';
import { getRecommendations, getReadinessColor, getReadinessEmoji, RecommendationResponse } from '../src/lib/recommendations';

export default function AICoachCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  async function loadRecommendations() {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecommendations();
      setRecommendations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations');
      console.error('Recommendations error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    await loadRecommendations();
  }

  if (loading && !recommendations) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>🤖 AI Coach</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        </View>
      </View>
    );
  }

  if (error && !recommendations) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>🤖 AI Coach</Text>
        </View>
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-triangle" size={24} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!recommendations) return null;

  const readinessScore = recommendations.scores.readiness;
  const readinessColor = getReadinessColor(readinessScore);
  const readinessEmoji = getReadinessEmoji(readinessScore);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>🤖 AI Coach</Text>
          <View style={[styles.badge, { backgroundColor: readinessColor }]}>
            <Text style={styles.badgeText}>
              {readinessEmoji} {readinessScore}/5
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={handleRefresh} disabled={loading} style={styles.iconButton}>
            <FontAwesome5 
              name="sync-alt" 
              size={16} 
              color={palette.text} 
              style={loading ? { opacity: 0.5 } : {}}
            />
          </Pressable>
          <Pressable onPress={() => setExpanded(!expanded)} style={styles.iconButton}>
            <FontAwesome5 
              name={expanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={palette.text} 
            />
          </Pressable>
        </View>
      </View>

      {expanded && (
        <ScrollView style={styles.content} nestedScrollEnabled>
          <Markdown
            style={{
              body: { color: palette.text, fontSize: 14 },
              heading2: { color: palette.text, fontSize: 18, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
              heading3: { color: palette.text, fontSize: 16, fontWeight: '600', marginTop: 10, marginBottom: 6 },
              paragraph: { color: palette.text, fontSize: 14, marginBottom: 8 },
              bullet_list: { color: palette.text, marginBottom: 8 },
              list_item: { color: palette.text, marginBottom: 4 },
              strong: { color: palette.accent, fontWeight: 'bold' },
              em: { fontStyle: 'italic', color: palette.text },
              hr: { backgroundColor: 'rgba(255, 255, 255, 0.2)', height: 1, marginVertical: 12 },
            }}
          >
            {recommendations.markdown}
          </Markdown>
        </ScrollView>
      )}

      {!expanded && (
        <Text style={styles.preview}>
          Tap to see personalized insights based on your last 7 days...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  content: {
    maxHeight: 400,
  },
  preview: {
    color: palette.text,
    fontSize: 14,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    color: palette.text,
    fontSize: 14,
    opacity: 0.7,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
