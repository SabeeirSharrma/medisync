// apps/flutter/lib/models/access_request.dart
class AccessRequest {
  final String id;
  final String doctorId;
  final String patientId;
  final Map<String, dynamic> scope;
  final String status;
  final DateTime? expiry;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? doctorName;
  final String? doctorEmail;
  final String? patientName;
  final String? patientEmail;
  
  AccessRequest({
    required this.id,
    required this.doctorId,
    required this.patientId,
    required this.scope,
    required this.status,
    this.expiry,
    required this.createdAt,
    required this.updatedAt,
    this.doctorName,
    this.doctorEmail,
    this.patientName,
    this.patientEmail,
  });
  
  factory AccessRequest.fromJson(Map<String, dynamic> json) {
    return AccessRequest(
      id: json['id'] as String,
      doctorId: json['doctorId'] as String,
      patientId: json['patientId'] as String,
      scope: json['scope'] as Map<String, dynamic>? ?? {},
      status: json['status'] as String,
      expiry: json['expiry'] != null ? DateTime.parse(json['expiry'] as String) : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      doctorName: json['doctorName'] as String?,
      doctorEmail: json['doctorEmail'] as String?,
      patientName: json['patientName'] as String?,
      patientEmail: json['patientEmail'] as String?,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'doctorId': doctorId,
      'patientId': patientId,
      'scope': scope,
      'status': status,
      'expiry': expiry?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'doctorName': doctorName,
      'doctorEmail': doctorEmail,
      'patientName': patientName,
      'patientEmail': patientEmail,
    };
  }
  
  String get formattedScope {
    final parts = <String>[];
    final categories = scope['categories'] as List<dynamic>?;
    if (categories != null && categories.isNotEmpty) {
      parts.add(categories.map((c) => c.toString().replaceAll('_', ' ')).join(', '));
    } else {
      parts.add('All types');
    }
    final dateFrom = scope['dateFrom'] as String?;
    final dateTo = scope['dateTo'] as String?;
    if (dateFrom != null || dateTo != null) {
      parts.add('${dateFrom ?? 'Start'} to ${dateTo ?? 'Now'}');
    }
    return parts.join(' | ');
  }
  
  Color get statusColor {
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'approved':
        return Colors.green;
      case 'denied':
        return Colors.red;
      case 'revoked':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }
  
  String get statusLabel => status[0].toUpperCase() + status.substring(1);
}