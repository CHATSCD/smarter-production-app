import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.keiths.superstores',
  appName: "Keith's Superstores",
  webDir: 'out',
  server: {
    url: 'https://YOUR-VERCEL-URL.vercel.app',
    cleartext: true
  },
  android: {
    backgroundColor: '#ffffff'
  }
};

export default config;
