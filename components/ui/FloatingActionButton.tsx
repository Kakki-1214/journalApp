import React from 'react';
import { TouchableOpacity, StyleSheet, Text, ViewStyle } from 'react-native';

export type FloatingActionButtonProps = {
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
};

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onPress, label = '＋', style }) => {
  return (
    <TouchableOpacity accessibilityLabel="新規作成" activeOpacity={0.85} onPress={onPress} style={[styles.fab, style]}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: { position:'absolute', right:20, bottom:30, backgroundColor:'#0a7ea4', width:60, height:60, borderRadius:30, alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.2, shadowRadius:8, elevation:4 },
  text: { color:'#fff', fontSize:30, lineHeight:34, fontWeight:'600', marginTop:-4 }
});
