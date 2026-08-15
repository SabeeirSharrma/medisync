// apps/flutter/lib/models/record.dart
class MedicalRecord {
  final String id;
  final String patientId;
  final String type;
  final String date;
  final String uploaderId;
  final String? doctorName;
  final String? hospitalName;
  final Map<String, dynamic> details;
  final String? attachmentKey;
  final String? contentType;
  final int? fileSize;
  final bool softDeleted;
  final String? versionOf;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  MedicalRecord({
    required this.id,
    required this.patientId,
    required this.type,
    required this.date,
    required this.uploaderId,
    this.doctorName,
    this.hospitalName,
    required this.details,
    this.attachmentKey,
    this.contentType,
    this.fileSize,
    required this.softDeleted,
    this.versionOf,
    required this.createdAt,
    required this.updatedAt,
  });
  
  factory MedicalRecord.fromJson(Map<String, dynamic> json) {
    return MedicalRecord(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      type: json['type'] as String,
      date: json['date'] as String,
      uploaderId: json['uploaderId'] as String,
      doctorName: json['doctorName'] as String?,
      hospitalName: json['hospitalName'] as String?,
      details: json['details'] as Map<String, dynamic>? ?? {},
      attachmentKey: json['attachmentKey'] as String?,
      contentType: json['contentType'] as String?,
      fileSize: json['fileSize'] as int?,
      softDeleted: json['softDeleted'] as bool? ?? false,
      versionOf: json['versionOf'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientId': patientId,
      'type': type,
      'date': date,
      'uploaderId': uploaderId,
      'doctorName': doctorName,
      'hospitalName': hospitalName,
      'details': details,
      'attachmentKey': attachmentKey,
      'contentType': contentType,
      'fileSize': fileSize,
      'softDeleted': softDeleted,
      'versionOf': versionOf,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
  
  String get formattedType => type.replaceAll('_', ' ').split(' ').map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');
  
  bool get hasAttachment => attachmentKey != null && attachmentKey!.isNotEmpty;
}