-- Migration 019: Update School Information to Noor-Ul-Ilm School System
-- Institutional identity update for Noor-Ul-Ilm School System, Islamabad, Pakistan.

ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS landline VARCHAR(50),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Pakistan',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'PKR';

-- Update the existing school_settings row
UPDATE public.school_settings
SET 
    school_name = 'Noor-Ul-Ilm School System',
    address = 'Block B, Multi Gardens, B-17, Islamabad, Pakistan',
    phone = '+92 333 5352110',
    landline = '051-7065481',
    email = 'info.noorulilmschoolsystem@gmail.com',
    website = 'https://www.noorulilm.info/',
    country = 'Pakistan',
    currency_symbol = 'Rs.',
    currency_code = 'PKR',
    timezone = 'Asia/Karachi',
    updated_at = NOW();
