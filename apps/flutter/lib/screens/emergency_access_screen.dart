// apps/flutter/lib/screens/emergency_access_screen.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/user.dart';
import '../services/api_service.dart';

class EmergencyAccessScreen extends StatefulWidget {
  final User user;

  const EmergencyAccessScreen({super.key, required this.user});

  @override
  State<EmergencyAccessScreen> createState() => _EmergencyAccessScreenState();
}

class _EmergencyAccessScreenState extends State<EmergencyAccessScreen> {
  List<dynamic> _accesses = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadEmergencyAccesses();
  }

  Future<void> _loadEmergencyAccesses() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final accesses = await ApiService.getEmergencyAccesses();
      setState(() {
        _accesses = accesses;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _revokeAccess(dynamic access) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke Emergency Access'),
        content: const Text('Are you sure you want to revoke this emergency access? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiService.revokeEmergencyAccess(access['id']);
        _loadEmergencyAccesses();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Emergency access revoked')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Access'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadEmergencyAccesses,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(_error!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadEmergencyAccesses,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _accesses.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.emergency, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(
                            'No emergency access records',
                            style: TextStyle(
                              fontSize: 18,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Emergency access allows doctors to view records in critical situations',
                            style: TextStyle(color: Colors.grey.shade500),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadEmergencyAccesses,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _accesses.length,
                        itemBuilder: (context, index) {
                          final access = _accesses[index];
                          return _buildAccessCard(access);
                        },
                      ),
                    ),
    );
  }

  Widget _buildAccessCard(dynamic access) {
    final status = access['status'] as String;
    final isActive = status == 'active';
    
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isActive ? Colors.red.shade50 : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isActive)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.red,
                          ),
                        ),
                      if (isActive) const SizedBox(width: 4),
                      Text(
                        status[0].toUpperCase() + status.substring(1),
                        style: TextStyle(
                          color: isActive ? Colors.red.shade700 : Colors.grey.shade700,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  DateFormat('MMM d, yyyy HH:mm').format(
                    DateTime.parse(access['createdAt']),
                  ),
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Doctor: ${access['doctorName'] ?? access['doctorId']}',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            Text(
              'Reason: ${access['reasonCode']}',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            if (access['reasonText'] != null) ...[
              const SizedBox(height: 4),
              Text(
                access['reasonText'],
                style: TextStyle(color: Colors.grey.shade600),
              ),
            ],
            if (access['expiresAt'] != null) ...[
              const SizedBox(height: 8),
              Text(
                'Expires: ${DateFormat('MMM d, yyyy HH:mm').format(
                  DateTime.parse(access['expiresAt']),
                )}',
                style: TextStyle(color: Colors.orange.shade700, fontSize: 12),
              ),
            ],
            if (isActive) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _revokeAccess(access),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                  ),
                  child: const Text('Revoke Access'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}