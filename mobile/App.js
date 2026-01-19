import 'react-native-gesture-handler';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { WeatherProvider } from './src/state/WeatherContext';
import { LandingScreen } from './src/screens/LandingScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { LocationsScreen } from './src/screens/LocationsScreen';
import { ReportScreen } from './src/screens/ReportScreen';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};

export default function App() {
  return (
    <WeatherProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" translucent />
        <Stack.Navigator
          initialRouteName="Landing"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="Locations" component={LocationsScreen} />
          <Stack.Screen name="Report" component={ReportScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </WeatherProvider>
  );
}
