import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chero.app',
  appName: 'Chéro',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      insetsHandling: 'disable',
      hidden: true,
    },
    LocalNotifications: {
      iconColor: '#10b981',
    },
  },
};

export default config;
