import React from 'react';
import { ScrollView, View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useJournal } from '@/context/JournalContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router';
import { StorageWarningBanner } from '@/components/subscription/StorageWarningBanner';

export default function JournalListScreen(){
	const { entries } = useJournal();
	const router = useRouter();
	return (
		<ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:24, paddingBottom:60 }}>
			<StorageWarningBanner />
			<View style={styles.headerRow}>
				<ThemedText type="title">Journal</ThemedText>
				<TouchableOpacity style={styles.newBtn} onPress={()=> router.push('/journal/new')}>
					<Text style={styles.newBtnText}>新規</Text>
				</TouchableOpacity>
			</View>
			{entries.length === 0 && (
				<ThemedText style={{ opacity:0.6, marginTop:32 }}>まだエントリがありません</ThemedText>
			)}
			{entries.map(e => (
				<TouchableOpacity key={e.id} onPress={()=> router.push(`/journal/${e.id}` as any)}>
					<ThemedView style={styles.entryCard}>
						<ThemedText style={styles.entryExcerpt} numberOfLines={2}>{e.content || '(No content)'}</ThemedText>
						<ThemedText style={styles.entryMeta}>{new Date(e.updatedAt).toLocaleString()}</ThemedText>
					</ThemedView>
				</TouchableOpacity>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
	newBtn: { backgroundColor:'#0a7ea4', paddingHorizontal:16, paddingVertical:10, borderRadius:10 },
	newBtnText: { color:'#fff', fontWeight:'600' },
	entryCard: { backgroundColor:'#fff', borderRadius:16, padding:16, marginBottom:14, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, elevation:2, gap:8 },
	entryExcerpt: { fontSize:14 },
	entryMeta: { fontSize:11, opacity:0.6 }
});
