// apps/flutter/lib/screens/dashboard_screen.dart
import 'package:flutter/material.dart';

import '../models/user.dart';
import '../services/api_service.dart';
import 'records_screen.dart';
import 'access_requests_screen.dart';
import 'emergency_access_screen.dart';
import 'guardian_screen.dart';
import 'settings_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  final User user;

  const DashboardScreen({super.key, required this.user});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  late User _user;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final user = await ApiService.getMe();
      if (mounted) {
        setState(() => _user = user);
      }
    } catch (e) {
      // Session might be expired
      if (mounted && e.toString().contains('Unauthorized')) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
        );
      }
    }
  }

  Future<void> _logout() async {
    try {
      await ApiService.logout();
    } catch (e) {
      // Ignore logout errors
    } finally {
      if (mounted) {
        await ApiService.clearToken();
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      _buildHomeTab(),
      RecordsScreen(user: _user),
      AccessRequestsScreen(user: _user),
      _user.isPatient
          ? EmergencyAccessScreen(user: _user)
          : GuardianScreen(user: _user),
      SettingsScreen(user: _user),
    ];

    return Scaffold(
      body: screens[_selectedIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home),
            selectedIcon: Icon(Icons.home, color: Color(0xFF2563EB)),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.folder),
            selectedIcon: Icon(Icons.folder, color: Color(0xFF2563EB)),
            label: 'Records',
          ),
          const NavigationDestination(
            icon: Icon(Icons.how_to_reg),
            selectedIcon: Icon(Icons.how_to_reg, color: Color(0xFF2563EB)),
            label: 'Access',
          ),
          NavigationDestination(
            icon: Icon(_user.isPatient ? Icons.emergency : Icons.shield),
            selectedIcon: Icon(
              _user.isPatient ? Icons.emergency : Icons.shield,
              color: const Color(0xFF2563EB),
            ),
            label: _user.isPatient ? 'Emergency' : 'Guardian',
          ),
          const NavigationDestination(
            icon: Icon(Icons.settings),
            selectedIcon: Icon(Icons.settings, color: Color(0xFF2563EB)),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab() {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadUser,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadUser,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Profile Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 30,
                          backgroundColor: const Color(0xFF2563EB),
                          child: Text(
                            _user.name.substring(0, 1).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _user.name,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                _user.email,
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: _user.isPatient
                                      ? Colors.blue.shade50
                                      : Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  _user.role[0].toUpperCase() + _user.role.substring(1),
                                  style: TextStyle(
                                    color: _user.isPatient
                                        ? Colors.blue.shade700
                                        : Colors.green.shade700,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Quick Actions
            const Text(
              'Quick Actions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: [
                _buildActionCard(
                  icon: Icons.folder_open,
                  title: 'View Records',
                  onTap: () => setState(() => _selectedIndex = 1),
                ),
                _buildActionCard(
                  icon: Icons.add_circle_outline,
                  title: 'Add Record',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => RecordsScreen(user: _user, initialAction: 'add'),
                      ),
                    );
                  },
                ),
                _buildActionCard(
                  icon: Icons.how_to_reg,
                  title: 'Access Requests',
                  onTap: () => setState(() => _selectedIndex = 2),
                ),
                if (_user.isDoctor)
                  _buildActionCard(
                    icon: Icons.upload_file,
                    title: 'Upload Record',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => RecordsScreen(user: _user, initialAction: 'upload'),
                        ),
                      );
                    },
                  ),
                if (_user.isPatient)
                  _buildActionCard(
                    icon: Icons.warning_amber,
                    title: 'Emergency Access',
                    onTap: () => setState(() => _selectedIndex = 3),
                  ),
                if (_user.isPatient)
                  _buildActionCard(
                    icon: Icons.shield,
                    title: 'Guardian Links',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => GuardianScreen(user: _user),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            
            // Info Section
            Card(
              color: Colors.blue.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _user.isPatient
                            ? 'Your records are encrypted and under your control. You decide who can access them.'
                            : 'Upload medical records for your patients. Access requires patient approval.',
                        style: TextStyle(color: Colors.blue.shade700),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 32, color: const Color(0xFF2563EB)),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}