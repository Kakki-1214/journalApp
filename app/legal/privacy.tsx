import { ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

export default function PrivacyPolicyScreen(){
  return (
    <ThemedView style={{ flex:1, padding:16 }}>
      <ScrollView contentContainerStyle={{ paddingBottom:48 }}>
        <ThemedText type="title">Privacy Policy (Draft)</ThemedText>
        <ThemedText style={{ marginTop:12 }}>
          This draft privacy policy describes what data the app processes. Replace this text with your finalized policy.
        </ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>1. Data We Collect</ThemedText>
        <ThemedText>- Account identifiers (email or provider subject)</ThemedText>
        <ThemedText>- Subscription status & receipts (for validation)</ThemedText>
        <ThemedText>- Refresh token metadata (for security)</ThemedText>
        <ThemedText>- Basic analytics events (non-personal) *planned*</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>2. Purpose</ThemedText>
        <ThemedText>Authentication, entitlement verification, fraud prevention, improving reliability.</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>3. Retention</ThemedText>
        <ThemedText>Audit and security logs kept up to 90 days (subject to change).</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>4. Deletion</ThemedText>
        <ThemedText>Use in-app account deletion. Data removal is irreversible.</ThemedText>
        <ThemedText style={{ marginTop:16, fontWeight:'600' }}>5. Contact</ThemedText>
        <ThemedText>Email: support@example.com (configure real email)</ThemedText>
        <View style={{ height:32 }} />
        <Link href=".." style={{ color:'#4e8af7' }}>Back</Link>
      </ScrollView>
    </ThemedView>
  );
}
