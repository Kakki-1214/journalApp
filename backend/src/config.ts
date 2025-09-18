export const CONFIG = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: '30d',
  dbFile: process.env.DB_FILE || 'data.sqlite',
  logLevel: process.env.LOG_LEVEL || 'info',
  isProduction: ['production','prod'].includes((process.env.NODE_ENV||'').toLowerCase()),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    serviceAccountEmail: process.env.GOOGLE_SA_EMAIL || '',
    // service account key: 平文 or base64(GOOGLE_SA_KEY_B64) 優先
    serviceAccountKey: (() => {
      if(process.env.GOOGLE_SA_KEY_B64) {
        try { return Buffer.from(process.env.GOOGLE_SA_KEY_B64,'base64').toString('utf8'); } catch { /* fallthrough */ }
      }
      return process.env.GOOGLE_SA_KEY?.replace(/\\n/g,'\n') || '';
    })()
  },
  apple: {
  clientId: process.env.APPLE_CLIENT_ID || '',
  // For real impl: Apple private key, keyId, teamId etc for server-to-server validation if needed
  sharedSecret: process.env.APPLE_SHARED_SECRET || ''
  }
};
