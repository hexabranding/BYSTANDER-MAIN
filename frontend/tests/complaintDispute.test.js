import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  submitComplaint,
  getMyComplaints,
  getComplaintById,
} from '../src/services/complaintService.js';
import {
  getComplaints as getAdminComplaints,
  getAdminComplaintById,
  updateComplaintStatus,
  addComplaintNote,
} from '../src/services/adminService.js';
import {
  adaptComplaint,
  normalizeComplaintStatus,
  denormalizeComplaintStatus,
} from '../src/services/adapters.js';

describe('Step 13D — Complaints & Dispute Management Frontend Services', () => {
  let mockFetchCalls = [];

  const MOCK_COMPLAINT_ID = '6711a1b2c3d4e5f6a7b8c801';
  const MOCK_COMPLAINT_NUMBER = 'CP-20261019-88214';
  const MOCK_BOOKING_ID = '6711a1b2c3d4e5f6a7b8c802';
  const MOCK_CUSTOMER_ID = '6711a1b2c3d4e5f6a7b8c803';
  const MOCK_CAREGIVER_ID = '6711a1b2c3d4e5f6a7b8c804';

  beforeEach(() => {
    mockFetchCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      const method = (options.method || 'GET').toUpperCase();
      const body = options.body ? JSON.parse(options.body) : null;
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers });

      // 1. POST /api/complaints — Submit complaint
      if (urlStr.endsWith('/api/complaints') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_COMPLAINT_ID,
              complaintNumber: MOCK_COMPLAINT_NUMBER,
              booking: body.bookingId || null,
              complainant: MOCK_CUSTOMER_ID,
              complainantRole: 'customer',
              category: body.category,
              priority: body.priority || 'Medium',
              status: 'submitted',
              subject: body.subject,
              description: body.description,
              evidence: body.evidence || [],
              timeline: [
                {
                  at: '2026-10-19T10:00:00.000Z',
                  action: 'Complaint submitted',
                  byRole: 'customer',
                },
              ],
              createdAt: '2026-10-19T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 2. GET /api/complaints — Customer own complaints list
      if (urlStr.includes('/api/complaints') && !urlStr.includes('/admin/') && method === 'GET' && !urlStr.includes(MOCK_COMPLAINT_ID)) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_COMPLAINT_ID,
                complaintNumber: MOCK_COMPLAINT_NUMBER,
                booking: {
                  _id: MOCK_BOOKING_ID,
                  bookingNumber: 'BK-8802',
                  serviceName: 'Patient Monitoring',
                  status: 'completed',
                },
                complainant: { _id: MOCK_CUSTOMER_ID, fullName: 'Ananya Roy', role: 'customer' },
                respondent: { _id: MOCK_CAREGIVER_ID, fullName: 'Rajesh Kumar', role: 'caregiver' },
                category: 'Late arrival',
                priority: 'Medium',
                status: 'under_review',
                subject: 'Caregiver delayed by 45 minutes',
                description: 'The caregiver arrived substantially past the scheduled start.',
                evidence: ['arrival_screenshot.png'],
                timeline: [
                  { at: '2026-10-19T09:00:00.000Z', action: 'Complaint submitted', byRole: 'customer' },
                  { at: '2026-10-19T10:00:00.000Z', action: 'Status changed to under_review', byRole: 'admin' },
                ],
                createdAt: '2026-10-19T09:00:00.000Z',
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 3. GET /api/complaints/:id — Single customer complaint
      if (urlStr.includes(`/api/complaints/${MOCK_COMPLAINT_ID}`) && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_COMPLAINT_ID,
              complaintNumber: MOCK_COMPLAINT_NUMBER,
              booking: { _id: MOCK_BOOKING_ID, bookingNumber: 'BK-8802', serviceName: 'Patient Monitoring' },
              complainant: { _id: MOCK_CUSTOMER_ID, fullName: 'Ananya Roy', role: 'customer' },
              respondent: { _id: MOCK_CAREGIVER_ID, fullName: 'Rajesh Kumar', role: 'caregiver' },
              category: 'Late arrival',
              priority: 'Medium',
              status: 'under_review',
              subject: 'Caregiver delayed by 45 minutes',
              description: 'The caregiver arrived substantially past the scheduled start.',
              evidence: ['arrival_screenshot.png'],
              timeline: [
                { at: '2026-10-19T09:00:00.000Z', action: 'Complaint submitted', byRole: 'customer' },
              ],
              createdAt: '2026-10-19T09:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 4. GET /api/admin/complaints — Admin list with triage stats
      if (urlStr.includes('/api/admin/complaints') && method === 'GET' && !urlStr.includes(MOCK_COMPLAINT_ID)) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_COMPLAINT_ID,
                complaintNumber: MOCK_COMPLAINT_NUMBER,
                booking: { _id: MOCK_BOOKING_ID, bookingNumber: 'BK-8802', totalAmount: 1200 },
                complainant: { fullName: 'Ananya Roy', email: 'ananya@example.com', role: 'customer' },
                respondent: { fullName: 'Rajesh Kumar', email: 'rajesh@example.com', role: 'caregiver' },
                category: 'Misbehavior',
                priority: 'High',
                status: 'submitted',
                subject: 'Unprofessional conduct on shift',
                description: 'Caretaker left before replacement handover.',
                internalNotes: [
                  { _id: '6711a1b2c3d4e5f6a7b8c809', note: 'Contacted caretaker for shift log', byName: 'Kavya Raman', at: '2026-10-19T10:30:00.000Z' },
                ],
                timeline: [
                  { at: '2026-10-19T10:00:00.000Z', action: 'Complaint submitted', byRole: 'customer' },
                ],
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            stats: { total: 1, open: 1, underReview: 0, resolved: 0, highPriority: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 5. GET /api/admin/complaints/:id — Admin detail with internal notes
      if (urlStr.includes(`/api/admin/complaints/${MOCK_COMPLAINT_ID}`) && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_COMPLAINT_ID,
              complaintNumber: MOCK_COMPLAINT_NUMBER,
              booking: { _id: MOCK_BOOKING_ID, bookingNumber: 'BK-8802', serviceName: 'Elder Care', totalAmount: 1500 },
              complainant: { fullName: 'Ananya Roy', email: 'ananya@example.com', role: 'customer' },
              respondent: { fullName: 'Rajesh Kumar', email: 'rajesh@example.com', role: 'caregiver' },
              category: 'Misbehavior',
              priority: 'High',
              status: 'under_review',
              subject: 'Unprofessional conduct on shift',
              description: 'Caretaker left before replacement handover.',
              internalNotes: [
                { _id: '6711a1b2c3d4e5f6a7b8c809', note: 'Caregiver interviewed; stated family arrived early', byName: 'Lead Admin', at: '2026-10-19T10:30:00.000Z' },
              ],
              timeline: [
                { at: '2026-10-19T10:00:00.000Z', action: 'Complaint submitted', byRole: 'customer' },
                { at: '2026-10-19T10:30:00.000Z', action: 'Internal investigation note added', byRole: 'admin' },
              ],
              createdAt: '2026-10-19T10:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 6. PATCH /api/admin/complaints/:id/status — Admin update status
      if (urlStr.includes(`/api/admin/complaints/${MOCK_COMPLAINT_ID}/status`) && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_COMPLAINT_ID,
              complaintNumber: MOCK_COMPLAINT_NUMBER,
              status: body.status,
              resolution: body.resolutionDetails
                ? { resolutionDetails: body.resolutionDetails, resolvedAt: '2026-10-19T11:00:00.000Z' }
                : null,
              timeline: [
                { at: '2026-10-19T11:00:00.000Z', action: `Status changed to ${body.status}`, byRole: 'admin' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 7. POST /api/admin/complaints/:id/notes — Admin append note
      if (urlStr.includes(`/api/admin/complaints/${MOCK_COMPLAINT_ID}/notes`) && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_COMPLAINT_ID,
              complaintNumber: MOCK_COMPLAINT_NUMBER,
              status: 'under_review',
              internalNotes: [
                { _id: '6711a1b2c3d4e5f6a7b8c810', note: body.note, byName: 'Investigator', at: '2026-10-19T11:15:00.000Z' },
              ],
              timeline: [
                { at: '2026-10-19T11:15:00.000Z', action: 'Internal investigation note added', byRole: 'admin' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  it('1. submitComplaint validates required fields and submits to POST /api/complaints', async () => {
    // Missing subject
    await assert.rejects(
      async () => submitComplaint({ description: 'Valid description', category: 'Other' }),
      /Subject must be at least 3 characters/,
    );

    // Missing description
    await assert.rejects(
      async () => submitComplaint({ subject: 'Valid subject', description: 'No', category: 'Other' }),
      /Description must be at least 5 characters/,
    );

    // Missing category
    await assert.rejects(
      async () => submitComplaint({ subject: 'Valid subject', description: 'Valid description' }),
      /category is required/,
    );

    // Valid submission
    const result = await submitComplaint({
      bookingId: MOCK_BOOKING_ID,
      category: 'Medical negligence',
      priority: 'High',
      subject: 'Missed vital medication dose',
      description: 'Caregiver failed to administer noon prescription.',
      evidence: ['medication_chart.pdf'],
    });

    assert.equal(mockFetchCalls.length, 1);
    assert.equal(mockFetchCalls[0].method, 'POST');
    assert.ok(mockFetchCalls[0].url.endsWith('/api/complaints'));
    assert.equal(mockFetchCalls[0].body.bookingId, MOCK_BOOKING_ID);
    assert.equal(mockFetchCalls[0].body.category, 'Medical negligence');
    assert.equal(mockFetchCalls[0].body.priority, 'High');

    assert.equal(result.id, MOCK_COMPLAINT_NUMBER);
    assert.equal(result.status, 'Submitted');
    assert.equal(result.priority, 'High');
  });

  it('2. getMyComplaints retrieves authenticated user complaints and strips internal notes', async () => {
    const { complaints, pagination } = await getMyComplaints({ page: 1, limit: 10 });

    assert.equal(mockFetchCalls.length, 1);
    assert.ok(mockFetchCalls[0].url.includes('/api/complaints'));
    assert.equal(complaints.length, 1);

    const c = complaints[0];
    assert.equal(c.id, MOCK_COMPLAINT_NUMBER);
    assert.equal(c.status, 'Under Review');
    assert.equal(c.complainant, 'Ananya Roy');
    assert.equal(c.against, 'Rajesh Kumar');
    assert.equal(c.againstType, 'Caregiver');
    assert.equal(c.bookingId, 'BK-8802');
    assert.deepEqual(c.internalNotes, [], 'Internal notes must be strictly empty for user list');
    assert.equal(pagination.total, 1);
  });

  it('3. getComplaintById retrieves single customer complaint record', async () => {
    const complaint = await getComplaintById(MOCK_COMPLAINT_ID);

    assert.equal(mockFetchCalls.length, 1);
    assert.ok(mockFetchCalls[0].url.includes(`/api/complaints/${MOCK_COMPLAINT_ID}`));
    assert.equal(complaint.id, MOCK_COMPLAINT_NUMBER);
    assert.equal(complaint.category, 'Late arrival');
    assert.equal(complaint.evidence.length, 1);
    assert.deepEqual(complaint.internalNotes, [], 'Internal notes must be stripped from public view');
  });

  it('4. adminService.getComplaints queries /api/admin/complaints with triage statistics', async () => {
    const { complaints, pagination, stats } = await getAdminComplaints({ status: 'Submitted', priority: 'High' });

    assert.equal(mockFetchCalls.length, 1);
    assert.ok(mockFetchCalls[0].url.includes('/api/admin/complaints'));
    assert.ok(mockFetchCalls[0].url.includes('status=submitted'));
    assert.equal(complaints.length, 1);

    const c = complaints[0];
    assert.equal(c.status, 'Submitted');
    assert.equal(c.priority, 'High');
    assert.equal(c.internalNotes.length, 1, 'Admin caller receives internalNotes');
    assert.equal(c.internalNotes[0].by, 'Kavya Raman');
    assert.equal(stats.total, 1);
    assert.equal(stats.highPriority, 1);
    assert.equal(pagination.page, 1);
  });

  it('5. adminService.getComplaintById returns admin detail with investigation notes', async () => {
    const complaint = await getAdminComplaintById(MOCK_COMPLAINT_ID);

    assert.equal(mockFetchCalls.length, 1);
    assert.ok(mockFetchCalls[0].url.includes(`/api/admin/complaints/${MOCK_COMPLAINT_ID}`));
    assert.equal(complaint.internalNotes.length, 1);
    assert.equal(complaint.internalNotes[0].note, 'Caregiver interviewed; stated family arrived early');
    assert.equal(complaint.internalNotes[0].by, 'Lead Admin');
    assert.equal(complaint.audit.length, 2);
  });

  it('6. adminService.updateComplaintStatus transitions status and denormalizes enum', async () => {
    const updated = await updateComplaintStatus(MOCK_COMPLAINT_ID, {
      status: 'Resolved',
      resolutionDetails: 'Customer apologized to and issued a goodwill waiver.',
    });

    assert.equal(mockFetchCalls.length, 1);
    assert.equal(mockFetchCalls[0].method, 'PATCH');
    assert.ok(mockFetchCalls[0].url.includes(`/api/admin/complaints/${MOCK_COMPLAINT_ID}/status`));
    assert.equal(mockFetchCalls[0].body.status, 'resolved');
    assert.equal(mockFetchCalls[0].body.resolutionDetails, 'Customer apologized to and issued a goodwill waiver.');
    assert.equal(updated.status, 'Resolved');
  });

  it('7. adminService.addComplaintNote appends note to investigation history', async () => {
    const updated = await addComplaintNote(MOCK_COMPLAINT_ID, {
      note: 'Followed up with attending hospital desk. Written log attached.',
    });

    assert.equal(mockFetchCalls.length, 1);
    assert.equal(mockFetchCalls[0].method, 'POST');
    assert.ok(mockFetchCalls[0].url.includes(`/api/admin/complaints/${MOCK_COMPLAINT_ID}/notes`));
    assert.equal(mockFetchCalls[0].body.note, 'Followed up with attending hospital desk. Written log attached.');
    assert.equal(updated.internalNotes.length, 1);
    assert.equal(updated.internalNotes[0].note, 'Followed up with attending hospital desk. Written log attached.');
  });

  it('8. Status normalization handles bidirectional mappings accurately', () => {
    // Normalization (Backend -> UI)
    assert.equal(normalizeComplaintStatus('submitted'), 'Submitted');
    assert.equal(normalizeComplaintStatus('under_review'), 'Under Review');
    assert.equal(normalizeComplaintStatus('action_taken'), 'Investigation');
    assert.equal(normalizeComplaintStatus('resolved'), 'Resolved');
    assert.equal(normalizeComplaintStatus('dismissed'), 'Dismissed');

    // Denormalization (UI -> Backend)
    assert.equal(denormalizeComplaintStatus('Submitted'), 'submitted');
    assert.equal(denormalizeComplaintStatus('Under Review'), 'under_review');
    assert.equal(denormalizeComplaintStatus('Investigation'), 'action_taken');
    assert.equal(denormalizeComplaintStatus('Action Taken'), 'action_taken');
    assert.equal(denormalizeComplaintStatus('Resolved'), 'resolved');
    assert.equal(denormalizeComplaintStatus('Dismissed'), 'dismissed');
  });

  it('9. adaptComplaint provides fallback defaults for missing fields', () => {
    assert.equal(adaptComplaint(null), null);
    assert.equal(adaptComplaint(undefined), null);

    const adapted = adaptComplaint({
      _id: '6711a1b2c3d4e5f6a7b8c900',
      subject: 'Issue',
      description: 'Detail',
    });

    assert.equal(adapted.id, '6711a1b2c3d4e5f6a7b8c900');
    assert.equal(adapted.status, 'Submitted');
    assert.equal(adapted.priority, 'Medium');
    assert.equal(adapted.category, 'Other');
    assert.equal(adapted.complainant, 'Customer');
    assert.equal(adapted.against, 'Bystander Platform');
    assert.deepEqual(adapted.evidence, []);
    assert.deepEqual(adapted.internalNotes, []);
    assert.deepEqual(adapted.audit, []);
  });
});
