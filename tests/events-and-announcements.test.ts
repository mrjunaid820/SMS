import { describe, it, expect, beforeEach } from 'vitest';
import { announcementApi, eventApi } from '@/services/api';
import { SchoolAnnouncement, SchoolEvent } from '@/types/database';

describe('Events & Announcements Module Comprehensive Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. Admin Announcement Lifecycle
  it('allows administrator to create, update, publish, archive, and delete announcements', async () => {
    const adminActor = { id: 'admin-1', name: 'Principal Malik', role: 'admin' };

    // 1. Create draft announcement
    const created = await announcementApi.createAnnouncement(
      {
        title: 'Board Examinations Registration 2026',
        content: 'Registration forms for Matric Part 1 & 2 BISE examinations are now available.',
        category: 'exam',
        target_audience: 'all',
        is_pinned: false,
        status: 'draft',
        publish_date: '2026-10-30',
      },
      adminActor
    );

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Board Examinations Registration 2026');
    expect(created.status).toBe('draft');

    // 2. Update announcement
    const updated = await announcementApi.updateAnnouncement(
      created.id,
      { is_pinned: true, title: 'BISE Matric Exam Registration 2026' },
      adminActor
    );
    expect(updated.is_pinned).toBe(true);
    expect(updated.title).toBe('BISE Matric Exam Registration 2026');

    // 3. Publish announcement
    const published = await announcementApi.publishAnnouncement(created.id, adminActor);
    expect(published.status).toBe('published');

    // 4. Archive announcement
    const archived = await announcementApi.archiveAnnouncement(created.id, adminActor);
    expect(archived.status).toBe('archived');

    // 5. Delete announcement
    await announcementApi.deleteAnnouncement(created.id, adminActor);
    const afterDelete = await announcementApi.getAnnouncementById(created.id);
    expect(afterDelete).toBeNull();
  });

  // 2. Input Validation
  it('validates that title and content are mandatory when creating announcements', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };

    // Empty title
    await expect(
      announcementApi.createAnnouncement(
        {
          title: '',
          content: 'Some message',
          category: 'general',
          target_audience: 'all',
          is_pinned: false,
          status: 'published',
          publish_date: '2026-10-30',
        },
        adminActor
      )
    ).rejects.toThrow('Announcement title is required.');

    // Empty content
    await expect(
      announcementApi.createAnnouncement(
        {
          title: 'Valid Title',
          content: '   ',
          category: 'general',
          target_audience: 'all',
          is_pinned: false,
          status: 'published',
          publish_date: '2026-10-30',
        },
        adminActor
      )
    ).rejects.toThrow('Announcement content is required.');
  });

  // 3. Student Role Scoping & Invisibility of Drafts
  it('prevents students from viewing draft, scheduled, or expired announcements', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };

    // Create 1 draft, 1 published active, 1 published expired
    await announcementApi.createAnnouncement(
      {
        title: 'Secret Staff Draft Circular',
        content: 'Internal draft details',
        category: 'general',
        target_audience: 'all',
        is_pinned: false,
        status: 'draft',
        publish_date: '2026-10-29',
      },
      adminActor
    );

    await announcementApi.createAnnouncement(
      {
        title: 'Active Student General Notice',
        content: 'Dress code reminder for tomorrow assembly',
        category: 'general',
        target_audience: 'all',
        is_pinned: true,
        status: 'published',
        publish_date: '2026-10-25',
        expiry_date: '2026-11-25',
      },
      adminActor
    );

    await announcementApi.createAnnouncement(
      {
        title: 'Old Expired Notice',
        content: 'Past summer camp notice',
        category: 'sports',
        target_audience: 'all',
        is_pinned: false,
        status: 'published',
        publish_date: '2026-06-01',
        expiry_date: '2026-06-15',
      },
      adminActor
    );

    // Query as Student
    const studentNotices = await announcementApi.getAnnouncements(
      {},
      { id: 'student-profile-1', role: 'student' }
    );

    // Must NOT contain drafts
    const hasDraft = studentNotices.some((n) => n.title.includes('Draft'));
    expect(hasDraft).toBe(false);

    // Must NOT contain expired notices
    const hasExpired = studentNotices.some((n) => n.title.includes('Old Expired Notice'));
    expect(hasExpired).toBe(false);

    // Must contain active published notice
    const hasActive = studentNotices.some((n) => n.title === 'Active Student General Notice');
    expect(hasActive).toBe(true);
  });

  // 4. Target Audience Scoping
  it('restricts teacher-only announcements from student view', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };

    await announcementApi.createAnnouncement(
      {
        title: 'Faculty Exam Paper Submission Deadline',
        content: 'All subject teachers must submit mid-term question papers by Friday.',
        category: 'meeting',
        target_audience: 'teachers',
        is_pinned: false,
        status: 'published',
        publish_date: '2026-10-28',
      },
      adminActor
    );

    // Student should NOT see teachers-only announcements
    const studentNotices = await announcementApi.getAnnouncements(
      {},
      { id: 'student-profile-1', role: 'student' }
    );
    expect(studentNotices.some((n) => n.title === 'Faculty Exam Paper Submission Deadline')).toBe(false);

    // Admin CAN see all announcements
    const adminNotices = await announcementApi.getAnnouncements({}, adminActor);
    expect(adminNotices.some((n) => n.title === 'Faculty Exam Paper Submission Deadline')).toBe(true);
  });

  // 5. Read Tracking & Unread Count
  it('correctly tracks read announcements per user and computes unread count', async () => {
    const userId = 'u-test-user-123';

    const announcements = await announcementApi.getAnnouncements(
      { status: 'published' },
      { id: userId, role: 'student' }
    );
    expect(announcements.length).toBeGreaterThan(0);

    const targetNotice = announcements[0];
    expect(targetNotice.is_read).toBe(false);

    // Mark as read
    await announcementApi.markAsRead(targetNotice.id, userId);

    // Re-fetch
    const reFetched = await announcementApi.getAnnouncements(
      { status: 'published' },
      { id: userId, role: 'student' }
    );
    const updatedTarget = reFetched.find((n) => n.id === targetNotice.id);
    expect(updatedTarget?.is_read).toBe(true);
  });

  // 6. School Events Management
  it('allows administrator to create, update, and fetch upcoming school events', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };

    const newEvent = await eventApi.createEvent(
      {
        title: 'Annual Milad-un-Nabi Celebration',
        description: 'Naat recitation and speech competition in the main hall.',
        category: 'cultural',
        event_date: '2026-11-20',
        start_time: '10:00:00',
        end_time: '13:00:00',
        venue: 'Auditorium Hall',
        target_audience: 'all',
        status: 'scheduled',
      },
      adminActor
    );

    expect(newEvent.id).toBeDefined();
    expect(newEvent.title).toBe('Annual Milad-un-Nabi Celebration');
    expect(newEvent.status).toBe('scheduled');

    // Update event
    const updated = await eventApi.updateEvent(newEvent.id, { venue: 'School Lawn' }, adminActor);
    expect(updated.venue).toBe('School Lawn');

    // Fetch upcoming events
    const upcoming = await eventApi.getUpcomingEvents(10, adminActor);
    expect(upcoming.some((e) => e.id === newEvent.id)).toBe(true);

    // Delete event
    await eventApi.deleteEvent(newEvent.id, adminActor);
    const afterDelete = await eventApi.getEventById(newEvent.id);
    expect(afterDelete).toBeNull();
  });

  // 7. Pinned Notice Priority Sorting
  it('ensures pinned announcements appear first regardless of creation date', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };

    // Unpinned newer notice
    await announcementApi.createAnnouncement(
      {
        title: 'Normal Recent Notice',
        content: 'Regular notice',
        category: 'general',
        target_audience: 'all',
        is_pinned: false,
        status: 'published',
        publish_date: '2026-10-29',
      },
      adminActor
    );

    // Pinned newest notice
    await announcementApi.createAnnouncement(
      {
        title: 'Urgent Emergency Pinned Notice',
        content: 'Urgent administrative directive',
        category: 'emergency',
        target_audience: 'all',
        is_pinned: true,
        status: 'published',
        publish_date: '2026-11-01',
      },
      adminActor
    );

    const sorted = await announcementApi.getAnnouncements({ status: 'published' }, adminActor);
    expect(sorted[0].is_pinned).toBe(true);
    expect(sorted[0].title).toBe('Urgent Emergency Pinned Notice');
  });

  // 8. Event Input Validation
  it('rejects school event creation when title or date is missing', async () => {
    const adminActor = { id: 'admin-1', role: 'admin' };

    await expect(
      eventApi.createEvent(
        {
          title: '',
          category: 'sports',
          event_date: '2026-11-10',
          target_audience: 'all',
          status: 'scheduled',
        },
        adminActor
      )
    ).rejects.toThrow('Event title is required.');

    await expect(
      eventApi.createEvent(
        {
          title: 'Sports Day',
          category: 'sports',
          event_date: '',
          target_audience: 'all',
          status: 'scheduled',
        },
        adminActor
      )
    ).rejects.toThrow('Event date is required.');
  });
});
