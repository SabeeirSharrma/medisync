// apps/flutter/lib/screens/record_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/user.dart';
import '../models/record.dart';
import '../services/api_service.dart';

class RecordDetailScreen extends StatelessWidget {
  final MedicalRecord record;
  final User user;

  const RecordDetailScreen({
    super.key,
    required this.record,
    required this.user,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(record.formattedType),
        actions: [
          if (record.hasAttachment)
            IconButton(
              icon: const Icon(Icons.download),
              onPressed: () => _downloadAttachment(context),
            ),
          if (user.isPatient)
            PopupMenuButton<String>(
              onSelected: (value) => _handleMenuAction(context, value),
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 'export_csv',
                  child: Text('Export as CSV'),
                ),
                const PopupMenuItem(
                  value: 'export_pdf',
                  child: Text('Export as PDF'),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete', style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Record Type Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _getTypeColor(record.type).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                record.formattedType,
                style: TextStyle(
                  color: _getTypeColor(record.type),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Date
            _buildInfoRow(Icons.calendar_today, 'Date',
                DateFormat('MMMM d, yyyy').format(DateTime.parse(record.date))),
            const SizedBox(height: 12),

            // Doctor
            if (record.doctorName != null) ...[
              _buildInfoRow(Icons.person, 'Doctor', record.doctorName!),
              const SizedBox(height: 12),
            ],

            // Hospital
            if (record.hospitalName != null) ...[
              _buildInfoRow(Icons.local_hospital, 'Hospital', record.hospitalName!),
              const SizedBox(height: 12),
            ],

            // Uploader
            _buildInfoRow(Icons.upload, 'Uploaded by', record.uploaderId),
            const SizedBox(height: 12),

            // Version
            if (record.versionOf != null) ...[
              _buildInfoRow(Icons.history, 'Version of', record.versionOf!),
              const SizedBox(height: 12),
            ],

            // Attachment
            if (record.hasAttachment) ...[
              const Divider(height: 32),
              const Text(
                'Attachment',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: ListTile(
                  leading: _getFileIcon(record.contentType),
                  title: Text(_getFileName(record)),
                  subtitle: Text(record.contentType ?? 'Unknown type'),
                  trailing: IconButton(
                    icon: const Icon(Icons.download),
                    onPressed: () => _downloadAttachment(context),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Details
            if (record.details.isNotEmpty) ...[
              const Divider(height: 32),
              const Text(
                'Details',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: record.details.entries.map((entry) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              entry.key.replaceAll('_', ' ').split(' ').map((w) => w[0].toUpperCase() + w.substring(1)).join(' '),
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                                color: Colors.grey.shade700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              entry.value?.toString() ?? 'N/A',
                              style: const TextStyle(fontSize: 16),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ],

            // Timestamps
            const Divider(height: 32),
            Text(
              'Created: ${DateFormat('MMM d, yyyy HH:mm').format(record.createdAt)}',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
            Text(
              'Updated: ${DateFormat('MMM d, yyyy HH:mm').format(record.updatedAt)}',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey.shade600),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
              Text(
                value,
                style: const TextStyle(fontSize: 16),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _getFileIcon(String? contentType) {
    if (contentType == null) return const Icon(Icons.insert_drive_file);
    if (contentType.startsWith('image/')) return const Icon(Icons.image);
    if (contentType == 'application/pdf') return const Icon(Icons.picture_as_pdf);
    return const Icon(Icons.insert_drive_file);
  }

  String _getFileName(MedicalRecord record) {
    if (record.attachmentKey == null) return 'Unknown';
    final parts = record.attachmentKey!.split('/');
    return parts.last;
  }

  Future<void> _downloadAttachment(BuildContext context) async {
    if (record.attachmentKey == null) return;
    
    try {
      final url = '${ApiService.baseUrl}/api/records/${record.id}/attachment?token=${ApiService.token}';
      if (await canLaunchUrl(Uri.parse(url))) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error downloading: $e')),
        );
      }
    }
  }

  Future<void> _handleMenuAction(BuildContext context, String action) async {
    switch (action) {
      case 'export_csv':
        try {
          final csv = await ApiService.exportCsv();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('CSV exported successfully')),
            );
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: $e')),
            );
          }
        }
        break;
      case 'export_pdf':
        try {
          final pdf = await ApiService.exportPdf();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('PDF exported successfully')),
            );
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: $e')),
            );
          }
        }
        break;
      case 'delete':
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete Record'),
            content: const Text('Are you sure you want to delete this record?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
                child: const Text('Delete'),
              ),
            ],
          ),
        );
        
        if (confirmed == true && context.mounted) {
          try {
            await ApiService.deleteRecord(record.id);
            Navigator.of(context).pop();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Record deleted')),
            );
          } catch (e) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: $e')),
            );
          }
        }
        break;
    }
  }

  Color _getTypeColor(String type) {
    switch (type) {
      case 'lab_result':
        return Colors.purple;
      case 'imaging':
        return Colors.blue;
      case 'prescription':
        return Colors.green;
      case 'discharge':
        return Colors.orange;
      case 'doctor_note':
        return Colors.teal;
      default:
        return Colors.grey;
    }
  }
}