import { ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

export default function TermsScreen(){
  return (
    <ThemedView style={{ flex:1, padding:16 }}>
      <ScrollView contentContainerStyle={{ paddingBottom:48 }}>
        <ThemedText type="title">Terms of Service (Draft)</ThemedText>
        <ThemedText style={{ marginTop:12 }}>
          These draft terms govern use of the app. Replace with your finalized legal text.
        </ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>1. Subscription</ThemedText>
        <ThemedText>Auto-renewing until cancelled via App Store / Google Play settings.</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>2. Acceptable Use</ThemedText>
        <ThemedText>No illegal content or abuse of the service.</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>3. Disclaimer</ThemedText>
        <ThemedText>Service provided as-is without warranties.</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>4. Changes</ThemedText>
        <ThemedText>We may update these terms with notice in-app.</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>5. Contact</ThemedText>
        <ThemedText>Email: support@example.com (configure real email)</ThemedText>
        <View style={{ height:32 }} />
        <Link href=".." style={{ color:'#4e8af7' }}>Back</Link>
      </ScrollView>
    </ThemedView>
  );
}
