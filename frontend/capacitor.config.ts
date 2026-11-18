import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.weshlameche.chero',
  appName: 'Chéro',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      insetsHandling: 'disable',
      hidden: false,
    },
    LocalNotifications: {
      iconColor: '#10b981',
    },
  },
};

export default config;
