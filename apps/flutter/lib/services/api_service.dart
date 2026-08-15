// apps/flutter/lib/services/api_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/user.dart';
import '../models/record.dart';
import '../models/access_request.dart';

class ApiService {
  static String? _token;
  static String _baseUrl = 'http://localhost:3001';
  static const _storage = FlutterSecureStorage();
  
  static String get baseUrl => _baseUrl;
  static String? get token => _token;
  
  static void setBaseUrl(String url) {
    _baseUrl = url;
  }
  
  static void setToken(String token) {
    _token = token;
  }
  
  static Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('session_token');
  }
  
  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('session_token', token);
    _token = token;
    await _storage.write(key: 'session_token', value: token);
  }
  
  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('session_token');
    await _storage.delete(key: 'session_token');
    _token = null;
  }
  
  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Cookie': 'session=$_token',
  };
  
  static Future<http.Response> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    http.Response response;
    
    switch (method) {
      case 'GET':
        response = await http.get(uri, headers: _headers);
        break;
      case 'POST':
        response = await http.post(
          uri,
          headers: _headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'PATCH':
        response = await http.patch(
          uri,
          headers: _headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'DELETE':
        response = await http.delete(uri, headers: _headers);
        break;
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }
    
    return response;
  }
  
  static T _parseResponse<T>(http.Response response, T Function(Map<String, dynamic>) fromJson) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return fromJson(data);
    } else {
      final error = jsonDecode(response.body) as Map<String, dynamic>?;
      throw Exception(error?['error'] ?? 'HTTP ${response.statusCode}');
    }
  }
  
  // Auth
  static Future<User> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String? dob,
    String? phone,
  }) async {
    final response = await _request('POST', '/api/auth/register', body: {
      'name': name,
      'email': email,
      'password': password,
      'role': role,
      if (dob != null) 'dob': dob,
      if (phone != null) 'phone': phone,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final user = User.fromJson(data['user'] as Map<String, dynamic>);
    return user;
  }
  
  static Future<User> login({
    required String email,
    required String password,
  }) async {
    final response = await _request('POST', '/api/auth/login', body: {
      'email': email,
      'password': password,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final user = User.fromJson(data['user'] as Map<String, dynamic>);
    return user;
  }
  
  static Future<void> logout() async {
    await _request('POST', '/api/auth/logout');
  }
  
  static Future<User> getMe() async {
    final response = await _request('GET', '/api/auth/me');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return User.fromJson(data['user'] as Map<String, dynamic>);
  }
  
  // Records
  static Future<MedicalRecord> createRecord({
    required String type,
    required String date,
    String? doctorName,
    String? hospitalName,
    Map<String, dynamic>? details,
  }) async {
    final response = await _request('POST', '/api/records', body: {
      'type': type,
      'date': date,
      if (doctorName != null) 'doctorName': doctorName,
      if (hospitalName != null) 'hospitalName': hospitalName,
      if (details != null) 'details': details,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return MedicalRecord.fromJson(data['record'] as Map<String, dynamic>);
  }
  
  static Future<({List<MedicalRecord> records, int total, int page, int totalPages})> getRecords({
    int page = 1,
    int limit = 10,
  }) async {
    final response = await _request('GET', '/api/records?page=$page&limit=$limit');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    
    return (
      records: (data['records'] as List).map((r) => MedicalRecord.fromJson(r as Map<String, dynamic>)).toList(),
      total: data['total'] as int,
      page: data['page'] as int,
      totalPages: data['totalPages'] as int,
    );
  }
  
  static Future<MedicalRecord> getRecord(String id) async {
    final response = await _request('GET', '/api/records/$id');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return MedicalRecord.fromJson(data['record'] as Map<String, dynamic>);
  }
  
  static Future<void> deleteRecord(String id) async {
    await _request('DELETE', '/api/records/$id');
  }
  
  static Future<MedicalRecord> updateRecord({
    required String id,
    String? type,
    String? date,
    String? doctorName,
    String? hospitalName,
    Map<String, dynamic>? details,
  }) async {
    final body = <String, dynamic>{};
    if (type != null) body['type'] = type;
    if (date != null) body['date'] = date;
    if (doctorName != null) body['doctorName'] = doctorName;
    if (hospitalName != null) body['hospitalName'] = hospitalName;
    if (details != null) body['details'] = details;
    
    final response = await _request('PATCH', '/api/records/$id', body: body);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return MedicalRecord.fromJson(data['record'] as Map<String, dynamic>);
  }
  
  // Access Requests
  static Future<AccessRequest> createAccessRequest({
    required String patientEmail,
    Map<String, dynamic>? scope,
  }) async {
    final response = await _request('POST', '/api/access-requests', body: {
      'patientEmail': patientEmail,
      if (scope != null) 'scope': scope,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return AccessRequest.fromJson(data['accessRequest'] as Map<String, dynamic>);
  }
  
  static Future<List<AccessRequest>> getAccessRequests() async {
    final response = await _request('GET', '/api/access-requests');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['accessRequests'] as List)
        .map((r) => AccessRequest.fromJson(r as Map<String, dynamic>))
        .toList();
  }
  
  static Future<AccessRequest> approveAccessRequest({
    required String id,
    required Map<String, dynamic> scope,
  }) async {
    final response = await _request('PATCH', '/api/access-requests/$id/approve', body: {
      'scope': scope,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return AccessRequest.fromJson(data['accessRequest'] as Map<String, dynamic>);
  }
  
  static Future<AccessRequest> denyAccessRequest(String id) async {
    final response = await _request('PATCH', '/api/access-requests/$id/deny');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return AccessRequest.fromJson(data['accessRequest'] as Map<String, dynamic>);
  }
  
  static Future<AccessRequest> revokeAccessRequest(String id) async {
    final response = await _request('PATCH', '/api/access-requests/$id/revoke');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return AccessRequest.fromJson(data['accessRequest'] as Map<String, dynamic>);
  }
  
  // Emergency Access
  static Future<dynamic> createEmergencyAccess({
    required String patientEmail,
    required String reasonCode,
    required String reasonText,
  }) async {
    final response = await _request('POST', '/api/emergency-access', body: {
      'patientEmail': patientEmail,
      'reasonCode': reasonCode,
      'reasonText': reasonText,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['emergencyAccess'];
  }
  
  static Future<List<dynamic>> getEmergencyAccesses() async {
    final response = await _request('GET', '/api/emergency-access');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['emergencyAccesses'] as List;
  }
  
  static Future<dynamic> revokeEmergencyAccess(String id) async {
    final response = await _request('PATCH', '/api/emergency-access/$id/revoke');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['emergencyAccess'];
  }
  
  // Guardian
  static Future<dynamic> createGuardianLink({
    required String patientEmail,
    required String guardianEmail,
    required String triggerType,
    String? authorityDocumentRef,
  }) async {
    final response = await _request('POST', '/api/guardian-links', body: {
      'patientEmail': patientEmail,
      'guardianEmail': guardianEmail,
      'triggerType': triggerType,
      if (authorityDocumentRef != null) 'authorityDocumentRef': authorityDocumentRef,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['guardianLink'];
  }
  
  static Future<List<dynamic>> getGuardianLinks() async {
    final response = await _request('GET', '/api/guardian-links');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['guardianLinks'] as List;
  }
  
  static Future<dynamic> updateGuardianStatus({
    required String id,
    required String status,
  }) async {
    final response = await _request('PATCH', '/api/guardian-links/$id/status', body: {
      'status': status,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['guardianLink'];
  }
  
  // Incapacity Requests
  static Future<dynamic> createIncapacityRequest({
    required String patientEmail,
    required String proposedGuardianEmail,
    required String practiceType,
    required String reason,
    String? supportingNote,
    required String legalDocumentImageRef,
    required String legalDocumentTranscript,
  }) async {
    final response = await _request('POST', '/api/incapacity-requests', body: {
      'patientEmail': patientEmail,
      'proposedGuardianEmail': proposedGuardianEmail,
      'practiceType': practiceType,
      'reason': reason,
      if (supportingNote != null) 'supportingNote': supportingNote,
      'legalDocumentImageRef': legalDocumentImageRef,
      'legalDocumentTranscript': legalDocumentTranscript,
    });
    
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['incapacityRequest'];
  }
  
  static Future<List<dynamic>> getIncapacityRequests() async {
    final response = await _request('GET', '/api/incapacity-requests');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['incapacityRequests'] as List;
  }
  
  // Export
  static Future<String> exportCsv({
    String? type,
    String? dateFrom,
    String? dateTo,
  }) async {
    final query = <String>[];
    if (type != null) query.add('type=$type');
    if (dateFrom != null) query.add('dateFrom=$dateFrom');
    if (dateTo != null) query.add('dateTo=$dateTo');
    
    final path = '/api/records/export/csv${query.isNotEmpty ? '?${query.join('&')}' : ''}';
    final uri = Uri.parse('$_baseUrl$path');
    
    final response = await http.get(uri, headers: _headers);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body;
    } else {
      final error = jsonDecode(response.body) as Map<String, dynamic>?;
      throw Exception(error?['error'] ?? 'HTTP ${response.statusCode}');
    }
  }
  
  static Future<List<int>> exportPdf({
    String? type,
    String? dateFrom,
    String? dateTo,
  }) async {
    final query = <String>[];
    if (type != null) query.add('type=$type');
    if (dateFrom != null) query.add('dateFrom=$dateFrom');
    if (dateTo != null) query.add('dateTo=$dateTo');
    
    final path = '/api/records/export/pdf${query.isNotEmpty ? '?${query.join('&')}' : ''}';
    final uri = Uri.parse('$_baseUrl$path');
    
    final response = await http.get(uri, headers: _headers);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    } else {
      final error = jsonDecode(response.body) as Map<String, dynamic>?;
      throw Exception(error?['error'] ?? 'HTTP ${response.statusCode}');
    }
  }
}