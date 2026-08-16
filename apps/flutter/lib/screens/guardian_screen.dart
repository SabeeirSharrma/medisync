// apps/flutter/lib/screens/guardian_screen.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/user.dart';
import '../services/api_service.dart';

class GuardianScreen extends StatefulWidget {
  final User user;

  const GuardianScreen({super.key, required this.user});

  @override
  State<GuardianScreen> createState() => _GuardianScreenState();
}

class _GuardianScreenState extends State<GuardianScreen> {
  List<dynamic> _links = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGuardianLinks();
  }

  Future<void> _loadGuardianLinks() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final links = await ApiService.getGuardianLinks();
      setState(() {
        _links = links;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateStatus(dynamic link, String status) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${status[0].toUpperCase() + status.substring(1)} Guardian Link'),
        content: Text('Are you sure you want to $status this guardian link?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: status == 'revoke' ? Colors.red : Colors.green,
            ),
            child: Text(status[0].toUpperCase() + status.substring(1)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiService.updateGuardianStatus(
          id: link['id'],
          status: status,
        );
        _loadGuardianLinks();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Guardian link ${status}d')),
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

  Future<void> _showAddDialog() async {
    final patientEmailController = TextEditingController();
    final guardianEmailController = TextEditingController();
    String triggerType = 'self';
    final authorityDocController = TextEditingController();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add Guardian Link'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: patientEmailController,
                decoration: const InputDecoration(
                  labelText: 'Patient Email',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: guardianEmailController,
                decoration: const InputDecoration(
                  labelText: 'Guardian Email',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: triggerType,
                decoration: const InputDecoration(
                  labelText: 'Trigger Type',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'self', child: Text('Self (minor/incompetent)')),
                  DropdownMenuItem(value: 'court', child: Text('Court order')),
                  DropdownMenuItem(value: 'patient', child: Text('Patient initiated')),
                ],
                onChanged: (value) => setDialogState(() => triggerType = value!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: authorityDocController,
                decoration: const InputDecoration(
                  labelText: 'Authority Document Reference (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop({
                  'patientEmail': patientEmailController.text,
                  'guardianEmail': guardianEmailController.text,
                  'triggerType': triggerType,
                  'authorityDoc': authorityDocController.text,
                });
              },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );

    if (result != null && result['patientEmail']!.isNotEmpty && result['guardianEmail']!.isNotEmpty) {
      try {
        await ApiService.createGuardianLink(
          patientEmail: result['patientEmail']!,
          guardianEmail: result['guardianEmail']!,
          triggerType: result['triggerType']!,
          authorityDocumentRef: result['authorityDoc']!.isEmpty ? null : result['authorityDoc'],
        );
        _loadGuardianLinks();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Guardian link created')),
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
        title: const Text('Guardian Links'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadGuardianLinks,
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
                        onPressed: _loadGuardianLinks,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _links.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shield, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(
                            'No guardian links',
                            style: TextStyle(
                              fontSize: 18,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Guardian links allow trusted individuals to access records when needed',
                            style: TextStyle(color: Colors.grey.shade500),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadGuardianLinks,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _links.length,
                        itemBuilder: (context, index) {
                          final link = _links[index];
                          return _buildLinkCard(link);
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        backgroundColor: const Color(0xFF2563EB),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildLinkCard(dynamic link) {
    final status = link['status'] as String;
    final isActive = status == 'active';
    final isPending = status == 'pending';
    
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
                    color: isActive
                        ? Colors.green.shade50
                        : isPending
                            ? Colors.orange.shade50
                            : Colors.grey.shade100,
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
                            color: Colors.green,
                          ),
                        ),
                      if (isActive) const SizedBox(width: 4),
                      Text(
                        status[0].toUpperCase() + status.substring(1),
                        style: TextStyle(
                          color: isActive
                              ? Colors.green.shade700
                              : isPending
                                  ? Colors.orange.shade700
                                  : Colors.grey.shade700,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  DateFormat('MMM d, yyyy').format(
                    DateTime.parse(link['createdAt']),
                  ),
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Patient: ${link['patientName'] ?? link['patientEmail'] ?? link['patientId']}',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Text(
              'Guardian: ${link['guardianName'] ?? link['guardianEmail'] ?? link['guardianId']}',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            Text(
              'Trigger: ${link['triggerType']?.toString().replaceAll('_', ' ') ?? 'Unknown'}',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            if (link['authorityDocumentRef'] != null) ...[
              const SizedBox(height: 4),
              Text(
                'Authority: ${link['authorityDocumentRef']}',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
            ],
            if (isPending || isActive) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (isPending) ...[
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _updateStatus(link, 'activate'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.green,
                          side: const BorderSide(color: Colors.green),
                        ),
                        child: const Text('Activate'),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (isActive)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _updateStatus(link, 'revoke'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                        ),
                        child: const Text('Revoke'),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}