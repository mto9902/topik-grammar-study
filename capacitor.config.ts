import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.example.topikgrammar',
  appName: 'TOPIK Grammar Study',
  webDir: 'dist',
  backgroundColor: '#e6e7ee',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
}

export default config
