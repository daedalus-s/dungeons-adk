import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Screens
import SessionScreen from './src/screens/SessionScreen';
import PlayerDashboard from './src/screens/PlayerDashboard';
import ApprovalQueue from './src/screens/ApprovalQueue';
import CharacterSetup from './src/screens/CharacterSetup';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Session Stack
const SessionStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Session" component={SessionScreen} />
  </Stack.Navigator>
);

// Character Stack
const CharacterStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Dashboard" component={PlayerDashboard} />
    <Stack.Screen name="CharacterSetup" component={CharacterSetup} />
  </Stack.Navigator>
);

// Main App
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                if (route.name === 'SessionTab') {
                  iconName = focused ? 'microphone' : 'microphone-outline';
                } else if (route.name === 'CharacterTab') {
                  iconName = focused ? 'account' : 'account-outline';
                } else if (route.name === 'ApprovalTab') {
                  iconName = focused ? 'check-circle' : 'check-circle-outline';
                } else if (route.name === 'SettingsTab') {
                  iconName = focused ? 'cog' : 'cog-outline';
                }

                return <Icon name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#6200ee',
              tabBarInactiveTintColor: 'gray',
            })}
          >
            <Tab.Screen
              name="SessionTab"
              component={SessionStack}
              options={{ title: 'Session', headerShown: false }}
            />
            <Tab.Screen
              name="CharacterTab"
              component={CharacterStack}
              options={{ title: 'Character', headerShown: false }}
            />
            <Tab.Screen
              name="ApprovalTab"
              component={ApprovalQueue}
              options={{ title: 'Approvals' }}
            />
            <Tab.Screen
              name="SettingsTab"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
