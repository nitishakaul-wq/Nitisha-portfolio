# AI Lead Generation System - Setup Guide

## What's Been Built

Your site now has a complete AI-powered lead generation system:

### 1. **Free AI Website Audit Tool** (`/audit-tool/`)
- Users enter any website URL
- Gets instant AI analysis on:
  - SEO Score (0-100)
  - Speed Score (0-100)
  - Design Score (0-100)
  - Overall Score
  - Actionable recommendations
- Lead magnet: Users enter email to get full detailed report
- All leads captured in database

### 2. **Marketing Agent Dashboard** (`/admin/`)
- Find leads by industry (Dental, Salon, Lawyer, Restaurant, Clinic)
- Choose target country (India or USA)
- AI generates personalized outreach emails for each lead
- Track lead status and responses
- Real-time statistics and performance metrics

### 3. **Database Tables**
- `website_audits` - Stores audit results
- `leads` - All prospects found/captured
- `campaigns` - Track outreach campaigns
- `outreach_emails` - Generated personalized pitches

### 4. **Edge Functions** (Deployed)
- `audit-website` - Analyzes websites using Groq AI
- `capture-lead` - Captures leads from audit tool
- `marketing-agent` - Finds leads and generates personalized pitches

## Important Setup Step: Add Groq API Key

The system uses Groq's fast AI models for website analysis. To enable full AI capabilities:

1. **Get Groq API Key**:
   - Visit https://console.groq.com/
   - Sign up (free account)
   - Go to API Keys section
   - Create new API key
   - Copy the key

2. **Add to Supabase** (Choose one method):

   **Option A: Via Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Settings → Edge Functions → Secrets
   - Add new secret:
     - Name: `GROQ_API_KEY`
     - Value: [Your Groq API Key]

   **Option B: Via Supabase CLI**
   ```bash
   supabase secrets set GROQ_API_KEY=your_groq_key
   ```

## Features Overview

### Website Audit Tool Flow
1. User visits `/audit-tool/`
2. Enters any website URL
3. Groq AI analyzes the HTML
4. Shows scores and recommendations
5. User can submit email for detailed report
6. Lead automatically captured in database

### Marketing Agent Flow
1. Dashboard user selects industry + country
2. System finds 2-3 relevant leads (mock data for now)
3. User clicks "Generate Personalized Pitches"
4. AI writes tailored email for each lead based on:
   - Business type (dental, salon, etc.)
   - Their website analysis (if available)
   - Industry-specific pain points
5. Emails stored in database
6. Can copy and send manually or integrate with email service

### Lead Capture
- Leads from audit tool captured automatically
- All leads accessible in admin dashboard
- Email domain detection for country (India/US)
- Track status: new → pitch_generated → sent → responded

## How to Use

### For Audit Tool
1. Share `/audit-tool/` link with potential customers
2. They analyze competitors' or own website
3. Get instant insights
4. Enter email for full report → becomes a lead

### For Lead Generation
1. Access `/admin/` (no password protection - add auth if needed)
2. Select industry and country
3. Click "Find New Leads"
4. System finds or creates leads
5. Click "Generate Personalized Pitches"
6. Review and copy emails
7. Send via your email client or automate integration

## Optional Enhancements

### Add Email Sending
To fully automate, integrate with email service:
- **SendGrid** - For transactional emails
- **Resend** - For outreach emails
- **Mailgun** - For high-volume campaigns

### Add Authentication
Protect admin dashboard:
```javascript
// Add Supabase Auth to /admin/
```

### Database Optimization
Currently using free-tier limits. For scaling:
- Add pagination to lead tables
- Archive old campaigns
- Add rate limiting to functions

## Database Schema

### leads table
```
id (uuid) - Primary key
business_name (text)
website_url (text)
email (text) - Required
phone (text)
industry (text) - dental, salon, lawyer, etc.
country (text) - IN or US
status (text) - new, pitch_generated, sent, responded
created_at (timestamp)
```

### outreach_emails table
```
id (uuid) - Primary key
lead_id (uuid) - Foreign key to leads
campaign_id (uuid)
email_subject (text)
email_body (text)
status (text) - pending, generated, sent, responded
created_at (timestamp)
```

## Tips for Best Results

1. **Audit Tool**: Share widely as a lead magnet
   - Post on LinkedIn
   - Add to website sidebar
   - Share in relevant communities

2. **Lead Generation**: Start with one industry
   - Test messaging
   - Refine pitches based on responses
   - Expand to other industries

3. **Follow-up**: Track responses
   - Mark responded leads
   - Adjust messaging based on feedback
   - Build nurture sequences

## Troubleshooting

**Audit Tool shows error?**
- Check Groq API key is set
- Ensure website is publicly accessible
- Try with a simple website first

**No leads appearing?**
- Check industry is selected
- Verify database connection
- Check browser console for errors

**Emails not generating?**
- Ensure leads exist in database
- Check Groq API key
- Verify function is deployed

## Support & Next Steps

The system is fully functional and ready to use!

Next ideas:
- Add Stripe integration for paid audit reports
- Build lead scoring algorithm
- Add CRM integration (HubSpot, Pipedrive)
- Create email template library
- Build response tracking system
