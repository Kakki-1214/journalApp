import React from 'react';
import { TextInput, ScrollView, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useJournalEditor } from '@/hooks/journal/useJournalEditor';

export default function TabJournalNew(){
  const router = useRouter();
  const editor = useJournalEditor();
  const { title, content, mood, setTitle, setContent, setMood, save } = editor;
  const onSave = async () => { const e = await save(); router.replace({ pathname: `/(tabs)/journal/${e.id}` as any }); };

  return (
    <ScrollView contentContainerStyle={{ padding:16 }}>
  <TextInput placeholder="タイトル" value={title} onChangeText={setTitle} style={styles.title} />
  <TextInput placeholder="本文" value={content} onChangeText={setContent} style={styles.content} multiline />
      <View style={styles.moodRow}>
        {['happy','neutral','sad','angry','anxious','grateful'].map(m => (
      <TouchableOpacity key={m} onPress={()=> setMood(m as any)} style={[styles.moodTag, mood===m && styles.moodTagActive]}>
            <Text style={{ color: mood===m? '#fff':'#333' }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
    <TouchableOpacity style={styles.saveBtn} onPress={onSave}><Text style={styles.saveBtnText}>保存</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:20, fontWeight:'600', marginBottom:12, borderBottomWidth:1, borderColor:'#ccc', paddingVertical:4 },
  content:{ minHeight:200, textAlignVertical:'top', borderWidth:1, borderColor:'#ccc', padding:10, borderRadius:8 },
  moodRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:16 },
  moodTag:{ paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'#999', borderRadius:16, backgroundColor:'#f5f5f5' },
  moodTagActive:{ backgroundColor:'#0a7ea4', borderColor:'#0a7ea4' },
  saveBtn:{ marginTop:24, backgroundColor:'#0a7ea4', paddingVertical:12, borderRadius:8, alignItems:'center' },
  saveBtnText:{ color:'#fff', fontSize:16, fontWeight:'600' }
});
