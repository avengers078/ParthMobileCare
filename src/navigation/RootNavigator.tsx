import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
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
import { ProfileScreen } from '../screens/ProfileScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { SecondHandScreen } from '../screens/SecondHandScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RegistrationStatusScreen } from '../screens/RegistrationStatusScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Core 4 primary modules for staff bottom navigation
const PRIMARY_TABS: Record<string, { label: string; icon: AppIconName }> = {
  HomeTab: { label: 'Home', icon: 'home' },
  LeadsTab: { label: 'Leads', icon: 'users' },
  PriceListTab: { label: 'Prices', icon: 'tag' },
  ProfileTab: { label: 'Profile', icon: 'user' },
};

const CustomBottomTabBar: React.FC<BottomTabBarProps> = React.memo(({
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
          borderTopColor: colors.border,
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
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel || config.label}
            accessibilityHint={isFocused ? 'Currently active tab' : `Switches to ${config.label} tab`}
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
                    backgroundColor: colors.primaryLight,
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
});

const renderCustomTabBar = (props: BottomTabBarProps) => <CustomBottomTabBar {...props} />;

const MainTabs: React.FC = React.memo(() => {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={renderCustomTabBar}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        lazy: true,
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
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
});

export const RootNavigator: React.FC = () => {
  const { currentUser, authStatus, isLoading, authError, retryAuth, logout, restartRegistration } = useAuth();
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

  // 1. Role Gatekeeper: Admin/Manager attempting to use Staff-only mobile app
  if (authStatus === 'unauthorized_role') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingLogoBox}>
          <Image source={APP_LOGO} style={styles.loadingLogo} resizeMode="contain" />
        </View>
        <View style={[styles.authErrorBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
          <Text style={[styles.authErrorBadgeText, { color: '#DC2626' }]}>ADMIN ACCESS RESTRICTED</Text>
        </View>
        <Text style={[styles.loadingText, { color: colors.text }]}>Web Dashboard Required</Text>
        <Text style={[styles.loadingCaption, { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginHorizontal: 20 }]}>
          Store administrators must manage store operations via the Parth Mobile Care Web Dashboard. This mobile app is exclusively for staff members.
        </Text>
        <TouchableOpacity
          style={[styles.authRetryButton, { backgroundColor: colors.primary }]}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={styles.authRetryButtonText}>Return to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Inactive Account Gatekeeper
  if (authStatus === 'inactive') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingLogoBox}>
          <Image source={APP_LOGO} style={styles.loadingLogo} resizeMode="contain" />
        </View>
        <View style={[styles.authErrorBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
          <Text style={[styles.authErrorBadgeText, { color: '#D97706' }]}>ACCOUNT INACTIVE</Text>
        </View>
        <Text style={[styles.loadingText, { color: colors.text }]}>Staff Account Deactivated</Text>
        <Text style={[styles.loadingCaption, { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginHorizontal: 20 }]}>
          Your staff account is currently inactive. Please reach out to your store manager or administrator to reactivate your access.
        </Text>
        <TouchableOpacity
          style={[styles.authRetryButton, { backgroundColor: colors.primary }]}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={styles.authRetryButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Genuine Network or Infrastructure Error
  if (authStatus === 'error' && authError) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingLogoBox}>
          <Image
            source={APP_LOGO}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.authErrorBadge}>
          <Text style={styles.authErrorBadgeText}>AUTHENTICATION NOTICE</Text>
        </View>
        <Text style={[styles.loadingText, { color: colors.text }]}>Authentication Verification</Text>
        <Text style={[styles.loadingCaption, { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginHorizontal: 20 }]}>
          {authError}
        </Text>
        <TouchableOpacity
          style={[styles.authRetryButton, { backgroundColor: colors.primary }]}
          onPress={retryAuth}
          activeOpacity={0.8}
        >
          <Text style={styles.authRetryButtonText}>Retry Verification</Text>
        </TouchableOpacity>
        {authError?.includes('staff profile is missing') && (
          <TouchableOpacity
            style={[styles.authRetryButton, { backgroundColor: '#10B981', marginTop: 8 }]}
            onPress={restartRegistration}
            activeOpacity={0.8}
          >
            <Text style={styles.authRetryButtonText}>Complete Staff Registration</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.authCancelButton, { borderColor: colors.border }]}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={[styles.authCancelButtonText, { color: colors.textSecondary }]}>Return to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 4. Incomplete Registration: Email verification or face enrollment in progress
  if (
    authStatus === 'authenticated_unverified' ||
    authStatus === 'face_enrollment_pending' ||
    authStatus === 'registration_incomplete'
  ) {
    return (
      <NavigationContainer>
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <RootStack.Screen name="Register" component={RegisterScreen} />
          <RootStack.Screen name="Login" component={LoginScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }

  // 5. Unauthenticated State
  if (!currentUser || authStatus === 'unauthenticated') {
    return (
      <NavigationContainer>
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="Register" component={RegisterScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }

  // 6. Registration Pending or Rejected
  if (
    authStatus === 'approval_pending' ||
    authStatus === 'rejected' ||
    !currentUser.isActive ||
    currentUser.registrationStatus !== 'approved'
  ) {
    return (
      <NavigationContainer>
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <RootStack.Screen name="RegistrationStatus" component={RegistrationStatusScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    );
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
  authErrorBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  authErrorBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  authRetryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  authRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authCancelButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  authCancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
