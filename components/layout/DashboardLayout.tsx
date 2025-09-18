import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Sidebar } from './Sidebar';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [auto, setAuto] = useState(false); // auto collapse due to width

  useEffect(() => {
    const check = () => {
      const w = Dimensions.get('window').width;
      if (w < 900) { setCollapsed(true); setAuto(true); } else if (auto) { setCollapsed(false); setAuto(false); }
    };
    check();
    const sub = Dimensions.addEventListener('change', check);
    return () => { sub.remove(); };
  }, [auto]);

  return (
    <View style={styles.root}>
      <Sidebar collapsed={collapsed} onNavigate={()=> auto && setCollapsed(true)} />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={()=> setCollapsed(c => !c)} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>{collapsed? '☰':'≡'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex:1 }}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex:1, flexDirection:'row', backgroundColor:'#F6F8FA' },
  content: { flex:1, padding: 0 },
  topBar: { height:46, flexDirection:'row', alignItems:'center', paddingHorizontal:12, borderBottomWidth:1, borderColor:'#E5E9EC', backgroundColor:'#FFFFFF' },
  toggleBtn: { padding:8, borderRadius:8, backgroundColor:'#E5ECF0' },
  toggleText: { fontSize:16, fontWeight:'600', color:'#17455e' }
});
