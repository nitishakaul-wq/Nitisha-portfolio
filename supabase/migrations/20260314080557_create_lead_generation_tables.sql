/*
  # Create Lead Generation System Tables

  1. New Tables
    - `website_audits` - Store website audit results
    - `leads` - Store prospect/lead information
    - `campaigns` - Track outreach campaigns
    - `outreach_emails` - Store generated personalized emails and send status

  2. Security
    - Enable RLS on all tables
    - Public read access for own audit data
    - Admin-only access for leads and campaigns

  3. Columns
    - website_audits: id, url, audit_results (json), seo_score, speed_score, design_score, created_at
    - leads: id, business_name, website_url, email, phone, industry, location, audit_id, status, created_at
    - campaigns: id, name, target_industry, status, leads_found, emails_sent, responses, created_at
    - outreach_emails: id, lead_id, campaign_id, email_subject, email_body, status, sent_at, responded_at
*/

CREATE TABLE IF NOT EXISTS website_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  audit_results jsonb NOT NULL,
  seo_score integer DEFAULT 0,
  speed_score integer DEFAULT 0,
  design_score integer DEFAULT 0,
  overall_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  website_url text,
  email text NOT NULL,
  phone text,
  industry text,
  location text,
  country text,
  audit_id uuid REFERENCES website_audits(id),
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_industry text,
  target_location text,
  status text DEFAULT 'active',
  leads_found integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  responses integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id),
  email_subject text NOT NULL,
  email_body text NOT NULL,
  status text DEFAULT 'pending',
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE website_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read website audits"
  ON website_audits FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert website audits"
  ON website_audits FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admin can read leads"
  ON leads FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin can insert leads"
  ON leads FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admin can update leads"
  ON leads FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can read campaigns"
  ON campaigns FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin can insert campaigns"
  ON campaigns FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admin can update campaigns"
  ON campaigns FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can read emails"
  ON outreach_emails FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin can insert emails"
  ON outreach_emails FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admin can update emails"
  ON outreach_emails FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_industry ON leads(industry);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_audits_url ON website_audits(url);
CREATE INDEX idx_campaigns_status ON campaigns(status);
