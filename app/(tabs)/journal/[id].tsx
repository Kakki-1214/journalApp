import React, { useEffect } from 'react';
import { View, ScrollView, TextInput, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { useJournalEditor } from '@/hooks/journal/useJournalEditor';

export default function TabJournalDetail(){
  const { id } = useLocalSearchParams<{ id:string }>();
  const router = useRouter();
  const editor = useJournalEditor({ entryId: id });
  const { title, content, mood, mode, setTitle, setContent, setMood, toggleMode, save, deleteEntry } = editor;

  useEffect(()=> {
    // If entry not found (id stays null after select attempt) show placeholder
  }, [editor.id]);

  if(!editor.id){
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Not found</Text></View>;
  }

  const confirmDelete = () => {
    Alert.alert('削除確認','このエントリを削除しますか?', [
      { text:'キャンセル', style:'cancel' },
      { text:'削除', style:'destructive', onPress: async ()=> { await deleteEntry(); router.replace('/(tabs)/journal' as any); }}
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding:16 }}>
      <TextInput value={title} onChangeText={setTitle} style={styles.title} />
      <View style={styles.modeSwitchRow}>
        <TouchableOpacity onPress={()=> mode==='preview' && toggleMode()} style={[styles.modeBtn, mode==='edit' && styles.modeBtnActive]}><Text style={[styles.modeBtnText, mode==='edit' && styles.modeBtnTextActive]}>Edit</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=> mode==='edit' && toggleMode()} style={[styles.modeBtn, mode==='preview' && styles.modeBtnActive]}><Text style={[styles.modeBtnText, mode==='preview' && styles.modeBtnTextActive]}>Preview</Text></TouchableOpacity>
      </View>
      {mode==='edit' ? (
        <TextInput value={content} onChangeText={setContent} style={styles.content} multiline placeholder="Body (Markdown supported)..." />
      ) : (
        <View style={styles.previewBox}>{content.trim()? <Markdown style={previewMarkdown}>{content}</Markdown> : <Text style={{ opacity:0.4,fontStyle:'italic' }}>Nothing to preview</Text>}</View>
      )}
      <View style={styles.moodRow}>
        {['happy','neutral','sad','angry','anxious','grateful'].map(m => (
          <TouchableOpacity key={m} onPress={()=> setMood(m as any)} style={[styles.moodTag, mood===m && styles.moodTagActive]}>
            <Text style={{ color: mood===m? '#fff':'#333' }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.saveBtn} onPress={save}><Text style={styles.saveBtnText}>更新</Text></TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}><Text style={styles.deleteBtnText}>削除</Text></TouchableOpacity>
      </View>
      <Text style={styles.timestamp}>作成: {editor.id && new Date(Number(editor.id.split('-')[0]) || Date.now()).toLocaleString()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:20, fontWeight:'600', marginBottom:12, borderBottomWidth:1, borderColor:'#ccc', paddingVertical:4 },
  content:{ minHeight:220, textAlignVertical:'top', borderWidth:1, borderColor:'#ccc', padding:10, borderRadius:8 },
  moodRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:16 },
  moodTag:{ paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'#999', borderRadius:16, backgroundColor:'#f5f5f5' },
  moodTagActive:{ backgroundColor:'#0a7ea4', borderColor:'#0a7ea4' },
  actionsRow:{ flexDirection:'row', gap:16, marginTop:24 },
  saveBtn:{ flex:1, backgroundColor:'#0a7ea4', paddingVertical:12, borderRadius:8, alignItems:'center' },
  saveBtnText:{ color:'#fff', fontSize:16, fontWeight:'600' },
  deleteBtn:{ width:100, backgroundColor:'#d32f2f', paddingVertical:12, borderRadius:8, alignItems:'center' },
  deleteBtnText:{ color:'#fff', fontSize:16, fontWeight:'600' },
  timestamp:{ marginTop:20, fontSize:12, opacity:0.7 },
  modeSwitchRow:{ flexDirection:'row', gap:8, marginBottom:12 },
  modeBtn:{ paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:'#E5ECF0' },
  modeBtnActive:{ backgroundColor:'#0a7ea4' },
  modeBtnText:{ color:'#17455e', fontWeight:'600' },
  modeBtnTextActive:{ color:'#fff' },
  previewBox:{ borderWidth:1, borderColor:'#D4DADF', borderRadius:8, padding:12, backgroundColor:'#FAFBFC', minHeight:220 }
});

const previewMarkdown = {
  body: { color:'#1f2d34', fontSize:15, lineHeight:22 },
  heading1: { fontSize:28, marginBottom:12 },
  heading2: { fontSize:22, marginTop:16, marginBottom:8 },
  code_inline: { backgroundColor:'#eef2f5', paddingHorizontal:6, paddingVertical:2, borderRadius:4, fontFamily:'monospace' },
  code_block: { backgroundColor:'#1e2830', color:'#fff', padding:12, borderRadius:8 },
  link: { color:'#0a7ea4' },
  emphasis: { fontStyle:'italic' as const },
  strong: { fontWeight:'700' as const }
};
