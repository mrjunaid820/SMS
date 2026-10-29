-- ==============================================================================
-- 015_events_and_announcements.sql
-- Events & Announcements Module for Islamia Public High School
-- 
-- Key Features:
-- 1. public.school_announcements (School-wide & Class-specific notices)
-- 2. public.school_events (Calendar events with date, time, venue, category)
-- 3. public.announcement_reads (Read/unread tracking per user)
-- 4. Granular Row Level Security (Admin full CRUD, Teacher scoped, Student read-only)
-- 5. Seed events and announcements for the academic term
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.school_announcements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'published',
    publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    attachment_url TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_announcement_category CHECK (
        category IN ('general', 'holiday', 'exam', 'meeting', 'admission', 'result', 'sports', 'celebration', 'emergency')
    ),
    CONSTRAINT chk_announcement_audience CHECK (
        target_audience IN ('all', 'teachers', 'students', 'class_section')
    ),
    CONSTRAINT chk_announcement_status CHECK (
        status IN ('draft', 'published', 'scheduled', 'archived')
    )
);

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.school_events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'academic',
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    venue VARCHAR(255) DEFAULT 'School Main Campus',
    instructions TEXT,
    target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_event_category CHECK (
        category IN ('academic', 'sports', 'cultural', 'holiday', 'meeting', 'examination', 'other')
    ),
    CONSTRAINT chk_event_audience CHECK (
        target_audience IN ('all', 'teachers', 'students', 'class_section')
    ),
    CONSTRAINT chk_event_status CHECK (
        status IN ('scheduled', 'ongoing', 'completed', 'cancelled')
    )
);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.announcement_reads
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.school_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_announcement_user_read UNIQUE (announcement_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON public.school_announcements(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.school_announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON public.school_announcements(target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_class_section ON public.school_announcements(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON public.school_announcements(is_pinned);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.school_events(event_date ASC);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.school_events(status);
CREATE INDEX IF NOT EXISTS idx_events_target_audience ON public.school_events(target_audience);

CREATE INDEX IF NOT EXISTS idx_reads_user ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_reads_announcement ON public.announcement_reads(announcement_id);

-- ------------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 6. RLS POLICIES: public.school_announcements
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on school_announcements" ON public.school_announcements;
CREATE POLICY "Admin full access on school_announcements"
    ON public.school_announcements FOR ALL
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers view school announcements" ON public.school_announcements;
CREATE POLICY "Teachers view school announcements"
    ON public.school_announcements FOR SELECT
    TO authenticated
    USING (
        public.is_teacher() AND (
            author_id = auth.uid() OR (
                status = 'published' AND
                publish_date <= CURRENT_DATE AND
                (expiry_date IS NULL OR expiry_date >= CURRENT_DATE) AND
                (
                    target_audience IN ('all', 'teachers') OR
                    (target_audience = 'class_section' AND (
                        section_id IN (
                            SELECT ta.section_id FROM public.teacher_assignments ta
                            WHERE ta.teacher_id = public.get_current_teacher_id()
                        ) OR
                        class_id IN (
                            SELECT s.class_id FROM public.sections s
                            JOIN public.teacher_assignments ta ON ta.section_id = s.id
                            WHERE ta.teacher_id = public.get_current_teacher_id()
                        )
                    ))
                )
            )
        )
    );

DROP POLICY IF EXISTS "Teachers insert class announcements" ON public.school_announcements;
CREATE POLICY "Teachers insert class announcements"
    ON public.school_announcements FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_teacher() AND
        author_id = auth.uid() AND
        target_audience = 'class_section'
    );

DROP POLICY IF EXISTS "Teachers update own announcements" ON public.school_announcements;
CREATE POLICY "Teachers update own announcements"
    ON public.school_announcements FOR UPDATE
    TO authenticated
    USING (
        public.is_teacher() AND author_id = auth.uid()
    );

DROP POLICY IF EXISTS "Teachers delete own announcements" ON public.school_announcements;
CREATE POLICY "Teachers delete own announcements"
    ON public.school_announcements FOR DELETE
    TO authenticated
    USING (
        public.is_teacher() AND author_id = auth.uid()
    );

DROP POLICY IF EXISTS "Students view target published announcements" ON public.school_announcements;
CREATE POLICY "Students view target published announcements"
    ON public.school_announcements FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'student' AND p.is_active = TRUE
        ) AND
        status = 'published' AND
        publish_date <= CURRENT_DATE AND
        (expiry_date IS NULL OR expiry_date >= CURRENT_DATE) AND
        (
            target_audience IN ('all', 'students') OR
            (target_audience = 'class_section' AND (
                section_id = public.get_current_student_section_id() OR
                class_id IN (
                    SELECT s.class_id FROM public.sections s
                    WHERE s.id = public.get_current_student_section_id()
                )
            ))
        )
    );

-- ------------------------------------------------------------------------------
-- 7. RLS POLICIES: public.school_events
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on school_events" ON public.school_events;
CREATE POLICY "Admin full access on school_events"
    ON public.school_events FOR ALL
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers view school events" ON public.school_events;
CREATE POLICY "Teachers view school events"
    ON public.school_events FOR SELECT
    TO authenticated
    USING (
        public.is_teacher() AND (
            target_audience IN ('all', 'teachers') OR
            (target_audience = 'class_section' AND (
                section_id IN (
                    SELECT ta.section_id FROM public.teacher_assignments ta
                    WHERE ta.teacher_id = public.get_current_teacher_id()
                ) OR
                class_id IN (
                    SELECT s.class_id FROM public.sections s
                    JOIN public.teacher_assignments ta ON ta.section_id = s.id
                    WHERE ta.teacher_id = public.get_current_teacher_id()
                )
            ))
        )
    );

DROP POLICY IF EXISTS "Students view school events" ON public.school_events;
CREATE POLICY "Students view school events"
    ON public.school_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'student' AND p.is_active = TRUE
        ) AND
        status != 'cancelled' AND
        (
            target_audience IN ('all', 'students') OR
            (target_audience = 'class_section' AND (
                section_id = public.get_current_student_section_id() OR
                class_id IN (
                    SELECT s.class_id FROM public.sections s
                    WHERE s.id = public.get_current_student_section_id()
                )
            ))
        )
    );

-- ------------------------------------------------------------------------------
-- 8. RLS POLICIES: public.announcement_reads
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own announcement reads" ON public.announcement_reads;
CREATE POLICY "Users can view own announcement reads"
    ON public.announcement_reads FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can mark announcements as read" ON public.announcement_reads;
CREATE POLICY "Users can mark announcements as read"
    ON public.announcement_reads FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own read status" ON public.announcement_reads;
CREATE POLICY "Users can delete own read status"
    ON public.announcement_reads FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 9. HELPER RPC FUNCTION: public.mark_announcement_as_read
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_announcement_as_read(p_announcement_id UUID)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO public.announcement_reads (announcement_id, user_id, read_at)
    VALUES (p_announcement_id, auth.uid(), now())
    ON CONFLICT (announcement_id, user_id) 
    DO UPDATE SET read_at = now();

    RETURN jsonb_build_object('success', true, 'announcement_id', p_announcement_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

GRANT EXECUTE ON FUNCTION public.mark_announcement_as_read TO authenticated;

-- ------------------------------------------------------------------------------
-- 10. GRANTS ON ALL NEW TABLES
-- ------------------------------------------------------------------------------
GRANT ALL ON public.school_announcements TO authenticated;
GRANT ALL ON public.school_events TO authenticated;
GRANT ALL ON public.announcement_reads TO authenticated;

-- ------------------------------------------------------------------------------
-- 11. INITIAL SEED DATA FOR ISLAMIA PUBLIC HIGH SCHOOL
-- ------------------------------------------------------------------------------
INSERT INTO public.school_announcements (
    id, title, content, category, target_audience, is_pinned, status, publish_date, expiry_date, author_id
) VALUES
(
    'e1000000-0000-0000-0000-000000000001',
    'Mid-Term Examinations 2025-2026 Schedule',
    'All faculty members, parents, and students are notified that Mid-Term Examinations will commence on October 15, 2025. Detailed date sheets have been published under the Examinations section. Roll number slips and syllabus guidelines are distributed by class teachers.',
    'exam',
    'all',
    TRUE,
    'published',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '30 days',
    '90000000-0000-0000-0000-000000000001'
),
(
    'e1000000-0000-0000-0000-000000000002',
    'Annual Inter-School Sports Gala 2026',
    'The Annual Sports Gala is scheduled for next month. Competitions will include Cricket, Football, Badminton, Table Tennis, and 100m Athletics. Students interested in participating must register with Master Muhammad Tariq or Sir Asif Mehmood by Friday.',
    'sports',
    'all',
    TRUE,
    'published',
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '20 days',
    '90000000-0000-0000-0000-000000000001'
),
(
    'e1000000-0000-0000-0000-000000000003',
    'Staff Academic Review Meeting',
    'A mandatory academic coordination meeting for all Senior and Junior teaching staff will be held in the Conference Hall on Saturday at 1:30 PM. Agenda includes mid-term syllabus progress and daily diary compliance.',
    'meeting',
    'teachers',
    FALSE,
    'published',
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE + INTERVAL '5 days',
    '90000000-0000-0000-0000-000000000001'
),
(
    'e1000000-0000-0000-0000-000000000004',
    'Iqbal Day Commemoration & Speech Contest',
    'Islamia Public High School will observe Iqbal Day with an inter-class speech and poetry recitation competition. Winning students will be awarded certificates and shields during the morning assembly.',
    'celebration',
    'students',
    FALSE,
    'published',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    '90000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.school_events (
    id, title, description, category, event_date, start_time, end_time, venue, instructions, target_audience, status, organizer_id
) VALUES
(
    'e2000000-0000-0000-0000-000000000001',
    'Annual Science & Robotics Exhibition',
    'Live working models and projects prepared by Matric Part 1 & Part 2 science students. Parents and external educational evaluators are invited.',
    'academic',
    CURRENT_DATE + INTERVAL '7 days',
    '09:00:00',
    '13:30:00',
    'School Main Auditorium & Physics Lab',
    'All participating groups must set up their stalls by 08:30 AM in proper school uniform.',
    'all',
    'scheduled',
    '90000000-0000-0000-0000-000000000001'
),
(
    'e2000000-0000-0000-0000-000000000002',
    'Parent-Teacher Coordination Conference (PTM)',
    'Discussion of Mid-Term examination results, student attendance percentages, and behavioral performance.',
    'meeting',
    CURRENT_DATE + INTERVAL '12 days',
    '08:30:00',
    '12:30:00',
    'Classrooms 101 to 204',
    'Parents are requested to bring student fee receipts and previous progress cards.',
    'all',
    'scheduled',
    '90000000-0000-0000-0000-000000000001'
),
(
    'e2000000-0000-0000-0000-000000000003',
    'Inter-House Cricket Championship Final',
    'Final clash between Jinnah House and Iqbal House for the 2025-26 School Championship Trophy.',
    'sports',
    CURRENT_DATE + INTERVAL '15 days',
    '10:00:00',
    '14:00:00',
    'School Cricket Ground',
    'Spectator students must sit in their designated house enclosures.',
    'students',
    'scheduled',
    '90000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;
