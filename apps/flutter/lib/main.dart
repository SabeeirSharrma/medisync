// apps/flutter/lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:permission_handler/permission_handler.dart';

import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/records_screen.dart';
import 'screens/access_requests_screen.dart';
import 'screens/emergency_access_screen.dart';
import 'screens/guardian_screen.dart';
import 'screens/settings_screen.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'models/user.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  await Firebase.initializeApp();
  
  // Initialize notifications
  await NotificationService.initialize();
  
  // Request permissions
  await _requestPermissions();
  
  // Check for existing session
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('session_token');
  final userJson = prefs.getString('user');
  
  User? initialUser;
  if (token != null && userJson != null) {
    initialUser = User.fromJson(userJson);
    ApiService.setToken(token);
  }
  
  runApp(MediSyncApp(initialUser: initialUser));
}

Future<void> _requestPermissions() async {
  // Request notification permissions
  await Permission.notification.request();
  
  // Request other permissions as needed
  await Permission.storage.request();
}

class MediSyncApp extends StatelessWidget {
  final User? initialUser;
  
  const MediSyncApp({super.key, this.initialUser});
  
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediSync',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          elevation: 0,
        ),
      ),
      darkTheme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.dark,
        ),
      ),
      home: initialUser != null 
          ? DashboardScreen(user: initialUser!) 
          : const LoginScreen(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/dashboard': (context) => DashboardScreen(user: initialUser!),
        '/records': (context) => RecordsScreen(user: initialUser!),
        '/access-requests': (context) => AccessRequestsScreen(user: initialUser!),
        '/emergency-access': (context) => EmergencyAccessScreen(user: initialUser!),
        '/guardian': (context) => GuardianScreen(user: initialUser!),
        '/settings': (context) => SettingsScreen(user: initialUser!),
      },
    );
  }
}

// Background message handler for FCM
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await NotificationService.showNotification(
    title: message.notification?.title ?? 'MediSync',
    body: message.notification?.body ?? 'New notification',
    payload: message.data,
  );
}