export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
  };
  plugins?: Record<string, unknown>;
}

const config: CapacitorConfig = {
  appId: 'com.tubewellkhata.app',
  appName: 'TubeWell Khata',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#087C71',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#087C71',
      style: 'DARK',
    },
    GoogleAuth: {
      scopes: [
        'profile',
        'email',
      ],
      clientId: '849806943027-f0du4l077ucpi05jrbi031t18c0ac56j.apps.googleusercontent.com',
      serverClientId: '849806943027-f0du4l077ucpi05jrbi031t18c0ac56j.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
