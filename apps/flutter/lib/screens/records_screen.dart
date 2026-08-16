// apps/flutter/lib/screens/records_screen.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/user.dart';
import '../models/record.dart';
import '../services/api_service.dart';
import 'record_detail_screen.dart';
import 'new_record_screen.dart';

class RecordsScreen extends StatefulWidget {
  final User user;
  final String? initialAction;

  const RecordsScreen({super.key, required this.user, this.initialAction});

  @override
  State<RecordsScreen> createState() => _RecordsScreenState();
}

class _RecordsScreenState extends State<RecordsScreen> {
  List<MedicalRecord> _records = [];
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;
  String? _selectedType;

  @override
  void initState() {
    super.initState();
    _loadRecords();
    
    if (widget.initialAction == 'add' || widget.initialAction == 'upload') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _navigateToNewRecord();
      });
    }
  }

  Future<void> _loadRecords() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ApiService.getRecords(
        page: _currentPage,
        limit: 10,
      );
      
      setState(() {
        _records = result.records;
        _totalPages = result.totalPages;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _navigateToNewRecord() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => NewRecordScreen(user: widget.user),
      ),
    );
    
    if (result == true) {
      _loadRecords();
    }
  }

  Future<void> _deleteRecord(String id) async {
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

    if (confirmed == true) {
      try {
        await ApiService.deleteRecord(id);
        _loadRecords();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Record deleted')),
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
        title: const Text('Medical Records'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (value) {
              setState(() => _selectedType = value == 'all' ? null : value);
              _loadRecords();
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'all', child: Text('All Types')),
              const PopupMenuItem(value: 'lab_result', child: Text('Lab Result')),
              const PopupMenuItem(value: 'imaging', child: Text('Imaging')),
              const PopupMenuItem(value: 'prescription', child: Text('Prescription')),
              const PopupMenuItem(value: 'discharge', child: Text('Discharge Summary')),
              const PopupMenuItem(value: 'doctor_note', child: Text('Doctor Note')),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _navigateToNewRecord,
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
                        onPressed: _loadRecords,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _records.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.folder_open, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(
                            'No records found',
                            style: TextStyle(
                              fontSize: 18,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Add your first medical record',
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            onPressed: _navigateToNewRecord,
                            icon: const Icon(Icons.add),
                            label: const Text('Add Record'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadRecords,
                      child: Column(
                        children: [
                          Expanded(
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _records.length,
                              itemBuilder: (context, index) {
                                final record = _records[index];
                                return _buildRecordCard(record);
                              },
                            ),
                          ),
                          if (_totalPages > 1)
                            _buildPagination(),
                        ],
                      ),
                    ),
      floatingActionButton: FloatingActionButton(
        onPressed: _navigateToNewRecord,
        backgroundColor: const Color(0xFF2563EB),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildRecordCard(MedicalRecord record) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => RecordDetailScreen(
                record: record,
                user: widget.user,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
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
                      color: _getTypeColor(record.type).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      record.formattedType,
                      style: TextStyle(
                        color: _getTypeColor(record.type),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (record.hasAttachment)
                    Icon(Icons.attach_file, size: 20, color: Colors.grey.shade600),
                  if (widget.user.isPatient)
                    PopupMenuButton<String>(
                      itemBuilder: (context) => [
                        const PopupMenuItem(
                          value: 'delete',
                          child: Text('Delete', style: TextStyle(color: Colors.red)),
                        ),
                      ],
                      onSelected: (value) {
                        if (value == 'delete') {
                          _deleteRecord(record.id);
                        }
                      },
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (record.doctorName != null)
                Text(
                  'Doctor: ${record.doctorName}',
                  style: TextStyle(color: Colors.grey.shade700),
                ),
              if (record.hospitalName != null)
                Text(
                  'Hospital: ${record.hospitalName}',
                  style: TextStyle(color: Colors.grey.shade700),
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 16, color: Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(
                    DateFormat('MMM d, yyyy').format(DateTime.parse(record.date)),
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  if (record.versionOf != null) ...[
                    const SizedBox(width: 12),
                    Icon(Icons.history, size: 16, color: Colors.grey.shade500),
                    const SizedBox(width: 4),
                    Text(
                      'Version',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPagination() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade200,
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            onPressed: _currentPage > 1
                ? () {
                    setState(() => _currentPage--);
                    _loadRecords();
                  }
                : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Text('Page $_currentPage of $_totalPages'),
          IconButton(
            onPressed: _currentPage < _totalPages
                ? () {
                    setState(() => _currentPage++);
                    _loadRecords();
                  }
                : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
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