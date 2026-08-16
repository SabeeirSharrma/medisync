// apps/flutter/lib/screens/new_access_request_screen.dart
import 'package:flutter/material.dart';

import '../services/api_service.dart';

class NewAccessRequestScreen extends StatefulWidget {
  const NewAccessRequestScreen({super.key});

  @override
  State<NewAccessRequestScreen> createState() => _NewAccessRequestScreenState();
}

class _NewAccessRequestScreenState extends State<NewAccessRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _patientEmailController = TextEditingController();
  final _scopeController = TextEditingController(text: '{"categories": [], "dateFrom": null, "dateTo": null}');
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _patientEmailController.dispose();
    _scopeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final scope = Map<String, dynamic>.from(
        Uri.decodeComponent(_scopeController.text) as Map,
      );
      
      await ApiService.createAccessRequest(
        patientEmail: _patientEmailController.text.trim(),
        scope: scope,
      );

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Request Access'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Patient Email
              TextFormField(
                controller: _patientEmailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Patient Email *',
                  prefixIcon: Icon(Icons.email),
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter patient email';
                  }
                  if (!value.contains('@')) {
                    return 'Please enter a valid email';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Scope
              TextFormField(
                controller: _scopeController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Access Scope (JSON) *',
                  prefixIcon: Icon(Icons.code),
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                  hintText: '{"categories": ["lab_result", "imaging"], "dateFrom": "2024-01-01", "dateTo": "2024-12-31"}',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter access scope';
                  }
                  try {
                    Map<String, dynamic>.from(Uri.decodeComponent(value) as Map);
                    return null;
                  } catch (e) {
                    return 'Invalid JSON format';
                  }
                },
              ),
              const SizedBox(height: 24),

              // Info Card
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
                          'Access requests require patient approval. You can specify which record types and date ranges to access.',
                          style: TextStyle(color: Colors.blue.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Error
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Colors.red.shade700),
                    textAlign: TextAlign.center,
                  ),
                ),
              if (_error != null) const SizedBox(height: 16),

              // Submit
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Request Access',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}