// apps/flutter/lib/main.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'services/api_service.dart';
import 'models/user.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Check for existing session
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('session_token');
  final userJson = prefs.getString('user');
  
  User? initialUser;
  if (token != null && userJson != null) {
    try {
      final userData = jsonDecode(userJson) as Map<String, dynamic>;
      initialUser = User.fromJson(userData);
      ApiService.setToken(token);
    } catch (_) {
      // Invalid stored data, start fresh
      await prefs.remove('session_token');
      await prefs.remove('user');
    }
  }
  
  runApp(MediSyncApp(initialUser: initialUser));
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
    );
  }
}