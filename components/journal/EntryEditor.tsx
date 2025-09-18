import React from 'react';
import { View, TextInput, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ThemedText } from '@/components/ThemedText';
import { useJournalEditor } from '@/hooks/journal/useJournalEditor';

export interface EntryEditorProps {
  editor: ReturnType<typeof useJournalEditor>;
  isEditingExisting: boolean;
  onDelete?: () => void;
  wide?: boolean;
}

export const EntryEditor: React.FC<EntryEditorProps> = ({ editor, isEditingExisting, onDelete, wide }) => {
  const { title, content, mode, setTitle, setContent, toggleMode, addTag, removeTag, newTag, setNewTag, tags, save, deleteEntry } = editor as any;

  const handleDelete = async () => { if(onDelete){ onDelete(); } else { await deleteEntry(); } };

  return (
    <ScrollView style={styles.editorPane} contentContainerStyle={{ padding: wide? 28:20 }}>
      <ThemedText type="title" style={{ marginBottom: 12 }}>{isEditingExisting? 'Edit Entry':'New Entry'}</ThemedText>
      <View style={styles.modeSwitchRow}>
        <TouchableOpacity onPress={()=> mode==='preview' && toggleMode()} style={[styles.modeBtn, mode==='edit' && styles.modeBtnActive]}><Text style={[styles.modeBtnText, mode==='edit' && styles.modeBtnTextActive]}>Edit</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=> mode==='edit' && toggleMode()} style={[styles.modeBtn, mode==='preview' && styles.modeBtnActive]}><Text style={[styles.modeBtnText, mode==='preview' && styles.modeBtnTextActive]}>Preview</Text></TouchableOpacity>
      </View>
      <View style={styles.editorCard}>
        <TextInput value={title} onChangeText={setTitle} placeholder="Title" style={styles.titleInput} />
        {mode==='edit' ? (
          <TextInput value={content} onChangeText={setContent} placeholder="Body (Markdown supported)..." multiline style={styles.bodyInput} />
        ) : (
          <ScrollView style={styles.previewBox} contentContainerStyle={{ padding:4 }}>
            {content.trim().length === 0 ? (
              <Text style={{ opacity:0.4, fontStyle:'italic' }}>Nothing to preview</Text>
            ) : (
              <Markdown style={markdownStyles}>{content}</Markdown>
            )}
          </ScrollView>
        )}
        <View style={styles.tagRow}>
          <TextInput value={newTag} onChangeText={setNewTag} placeholder="tag" style={styles.tagInput} />
          <TouchableOpacity onPress={addTag} style={styles.tagAddBtn}><Text style={styles.btnText}>Add Tag</Text></TouchableOpacity>
        </View>
        <View style={styles.tagsWrap}>
          {tags.map((t: string) => (
            <TouchableOpacity key={t} style={styles.tagPill} onPress={() => removeTag(t)}>
              <Text style={styles.tagPillText}>{t} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actions}>
          {isEditingExisting && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>
          )}
          <TouchableOpacity onPress={save} style={styles.saveBtn}><Text style={styles.saveBtnText}>{isEditingExisting? 'Update':'Save'}</Text></TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  editorPane: { flex:1 },
  modeSwitchRow: { flexDirection:'row', gap:8, marginBottom:14 },
  modeBtn: { paddingHorizontal:16, paddingVertical:10, borderRadius:8, backgroundColor:'#E5ECF0' },
  modeBtnActive: { backgroundColor:'#0a7ea4' },
  modeBtnText: { color:'#17455e', fontWeight:'600' },
  modeBtnTextActive: { color:'#fff' },
  editorCard: { backgroundColor:'#fff', padding:24, borderRadius:18, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, elevation:2 },
  titleInput: { borderWidth:1, borderColor:'#C8D2DC', borderRadius:8, paddingHorizontal:12, height:44, marginBottom:16, backgroundColor:'#FDFEFE' },
  bodyInput: { borderWidth:1, borderColor:'#E3E8EC', borderRadius:8, minHeight:200, padding:12, textAlignVertical:'top', backgroundColor:'#FFFFFF', marginBottom:16 },
  tagRow: { flexDirection:'row', gap:8, marginBottom:12 },
  tagInput: { flex:1, borderWidth:1, borderColor:'#D7E0E6', borderRadius:8, paddingHorizontal:10, backgroundColor:'#fff' },
  tagAddBtn: { backgroundColor:'#0a7ea4', borderRadius:8, paddingHorizontal:16, justifyContent:'center' },
  btnText: { color:'#fff', fontWeight:'600' },
  tagsWrap: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  tagPill: { backgroundColor:'#E8F4F8', paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  tagPillText: { fontSize:12, color:'#0a617c', fontWeight:'600' },
  actions: { flexDirection:'row', justifyContent:'flex-end', gap:12, marginTop:24 },
  saveBtn: { backgroundColor:'#005ea6', paddingHorizontal:28, paddingVertical:14, borderRadius:10 },
  saveBtnText: { color:'#fff', fontWeight:'600' },
  deleteBtn: { backgroundColor:'#d84b3a', paddingHorizontal:18, paddingVertical:14, borderRadius:10 },
  deleteBtnText: { color:'#fff', fontWeight:'600' },
  previewBox:{ borderWidth:1, borderColor:'#E3E8EC', borderRadius:8, minHeight:200, backgroundColor:'#FAFBFC', padding:8, marginBottom:16 }
});

const markdownStyles = {
  body: { color:'#1f2d34', fontSize:15, lineHeight:22 },
  heading1: { fontSize:28, marginBottom:12 },
  heading2: { fontSize:22, marginTop:16, marginBottom:8 },
  code_inline: { backgroundColor:'#eef2f5', paddingHorizontal:6, paddingVertical:2, borderRadius:4, fontFamily:'monospace' },
  code_block: { backgroundColor:'#1e2830', color:'#fff', padding:12, borderRadius:8 },
  bullet_list: { marginVertical:6 },
  ordered_list: { marginVertical:6 },
  list_item: { marginVertical:2 },
  link: { color:'#0a7ea4' },
  emphasis: { fontStyle:'italic' as const },
  strong: { fontWeight:'700' as const },
};

export default EntryEditor;
