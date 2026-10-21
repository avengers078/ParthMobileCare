import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Image, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';

const APP_LOGO = require('../assets/logo.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon, AppIconName } from '../components';

import { HomeScreen } from '../screens/HomeScreen';
import { LeadListScreen } from '../screens/LeadListScreen';
import { PriceListScreen } from '../screens/PriceListScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { SecondHandScreen } from '../screens/SecondHandScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { StaffManagementScreen } from '../screens/StaffManagementScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Core 5 primary modules for bottom navigation
const PRIMARY_TABS: Record<string, { label: string; icon: AppIconName }> = {
  HomeTab: { label: 'Home', icon: 'home' },
  LeadsTab: { label: 'Leads', icon: 'users' },
  PriceListTab: { label: 'Prices', icon: 'tag' },
  ReportsTab: { label: 'Reports', icon: 'analytics' },
  ProfileTab: { label: 'Profile', icon: 'user' },
};

const CustomBottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // Safe bottom spacing for Android system navigation pill and iOS home indicator
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: colors.card,
          borderTopColor: isDark ? colors.border : '#E2E8F0',
          paddingBottom: bottomInset,
          height: 58 + bottomInset,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const config = PRIMARY_TABS[route.name] || { label: route.name, icon: 'home' as AppIconName };
        const tintColor = isFocused ? colors.primary : colors.textSecondary;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel || config.label}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && { opacity: 0.72 },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                isFocused && [
                  styles.activeIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.22)' : '#EFF6FF',
                    borderRadius: 14,
                    overflow: 'hidden',
                  },
                ],
              ]}
            >
              <AppIcon
                name={config.icon}
                size={19}
                color={tintColor}
                strokeWidth={isFocused ? 2.4 : 1.8}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.tabLabelText,
                {
                  color: tintColor,
                  fontWeight: isFocused ? '700' : '500',
                },
              ]}
            >
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={props => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="LeadsTab"
        component={LeadListScreen}
        options={{ tabBarLabel: 'Leads' }}
      />
      <Tab.Screen
        name="PriceListTab"
        component={PriceListScreen}
        options={{ tabBarLabel: 'Prices' }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{ tabBarLabel: 'Reports' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingLogoBox}>
          <Image
            source={APP_LOGO}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.loadingText, { color: colors.text }]}>Parth Mobile Care</Text>
        <Text style={[styles.loadingCaption, { color: colors.textSecondary }]}>
          Preparing your workspace...
        </Text>
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {/* Core Primary Tabs Container */}
        <RootStack.Screen name="MainTabs" component={MainTabs} />

        {/* Secondary Modules (Stack Navigation with Back Stack) */}
        <RootStack.Screen name="Attendance" component={AttendanceScreen} />
        <RootStack.Screen name="AttendanceTab" component={AttendanceScreen} />
        <RootStack.Screen name="BuySell" component={SecondHandScreen} />
        <RootStack.Screen name="BuySellTab" component={SecondHandScreen} />
        <RootStack.Screen name="StaffManagement" component={StaffManagementScreen} />
        <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingLogoBox: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    overflow: 'hidden',
  },
  loadingLogo: {
    width: 124,
    height: 124,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '800',
  },
  loadingCaption: {
    marginTop: 6,
    fontSize: 13,
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    paddingTop: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 2,
  },
  iconBox: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  activeIconBox: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  tabLabelText: {
    fontSize: 10.5,
    lineHeight: 13,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
