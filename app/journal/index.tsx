// Single redirect used to preserve older deep links like journal://journal
// while actual implementation lives under /(tabs)/journal stack.
import React from 'react';
import { Redirect } from 'expo-router';
export default function JournalFolderRedirect(){ return <Redirect href="/journal" />; }
