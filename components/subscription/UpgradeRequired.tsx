import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSubscription } from '../../context/SubscriptionContext';

interface Props {
  requiredCapability?: string;
  onPressUpgrade?: () => void;
}

export const UpgradeRequired: React.FC<Props> = ({ requiredCapability, onPressUpgrade }) => {
  const { purchasing } = useSubscription();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>アップグレードが必要です</Text>
      {requiredCapability && (
        <Text style={styles.cap}>機能: {requiredCapability}</Text>
      )}
      <Text style={styles.desc}>この機能を利用するには Pro または Lifetime プランへのアップグレードが必要です。</Text>
      <TouchableOpacity style={styles.button} disabled={purchasing} onPress={onPressUpgrade}>
        <Text style={styles.buttonText}>{purchasing ? '処理中...' : 'プランを確認する'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  cap: { fontSize: 12, color: '#666' },
  desc: { fontSize: 14, textAlign: 'center', color: '#444' },
  button: { backgroundColor: '#4a67f5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '600' }
});
