import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CampaignRequest {
  industry?: string;
  country?: string;
  action: "find_leads" | "generate_pitch" | "get_status";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const campaignData: CampaignRequest = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (campaignData.action === "find_leads") {
      return await findLeads(supabase, campaignData.industry, campaignData.country);
    } else if (campaignData.action === "generate_pitch") {
      return await generatePitch(supabase, groqApiKey);
    } else if (campaignData.action === "get_status") {
      return await getCampaignStatus(supabase);
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Marketing agent error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function findLeads(
  supabase: any,
  industry?: string,
  country?: string
) {
  const mockLeads = generateMockLeads(industry || "dental", country || "IN");

  let insertedCount = 0;
  for (const lead of mockLeads) {
    const { error } = await supabase.from("leads").insert([lead]);
    if (!error) insertedCount++;
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Found and created ${insertedCount} leads`,
      leads_count: insertedCount,
      industry: industry || "dental",
      country: country || "IN",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function generatePitch(supabase: any, groqApiKey?: string) {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", "new")
    .limit(5);

  if (error || !leads || leads.length === 0) {
    return new Response(
      JSON.stringify({ message: "No new leads to pitch" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const pitches = [];
  for (const lead of leads) {
    const pitch = generatePersonalizedPitch(lead);
    pitches.push({
      lead_id: lead.id,
      subject: pitch.subject,
      body: pitch.body,
    });

    await supabase.from("outreach_emails").insert([
      {
        lead_id: lead.id,
        email_subject: pitch.subject,
        email_body: pitch.body,
        status: "generated",
      },
    ]);

    await supabase
      .from("leads")
      .update({ status: "pitch_generated" })
      .eq("id", lead.id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Generated ${pitches.length} personalized pitches`,
      pitches: pitches,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function getCampaignStatus(supabase: any) {
  const { data: campaigns } = await supabase.from("campaigns").select("*");
  const { data: leads } = await supabase.from("leads").select("status");
  const { data: emails } = await supabase.from("outreach_emails").select("status");

  const stats = {
    total_campaigns: campaigns?.length || 0,
    total_leads: leads?.length || 0,
    new_leads: leads?.filter((l: any) => l.status === "new").length || 0,
    emails_generated: emails?.filter((e: any) => e.status === "generated").length || 0,
    emails_sent: emails?.filter((e: any) => e.status === "sent").length || 0,
  };

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateMockLeads(industry: string, country: string) {
  const businesses = {
    dental: ["SmileCare Dental", "DentaPlus Clinic", "Bright Smile Dentistry", "Dental Heights", "Care Dental Studio"],
    salon: ["Hair Haven", "Luxe Salon", "Beauty Bliss", "Style Studio", "Prime Beauty"],
    lawyer: ["Legal Partners", "Justice Law Firm", "Rights & Associates", "Legal Pro", "Law Solutions"],
    restaurant: ["Flavor Fusion", "Taste House", "Spice Kitchen", "Food Court", "Fresh Bites"],
    clinic: ["Health Plus", "Wellness Center", "Care Clinic", "Medical Hub", "Healing Center"],
  };

  const domainIndustries = {
    dental: "@dentalofffice.in",
    salon: "@beautysalon.in",
    lawyer: "@lawfirm.in",
    restaurant: "@restaurant.in",
    clinic: "@healthcenter.in",
  };

  const selectedBusinesses = businesses[industry as keyof typeof businesses] || businesses.dental;
  const businessCount = Math.random() > 0.7 ? 3 : 2;

  const leads = [];
  for (let i = 0; i < businessCount; i++) {
    const business = selectedBusinesses[Math.floor(Math.random() * selectedBusinesses.length)];
    leads.push({
      business_name: business,
      email: `${business.toLowerCase().replace(/\s+/g, "")}@email${country === "IN" ? ".in" : ".com"}`,
      phone: generatePhoneNumber(country),
      industry: industry,
      country: country,
      status: "new",
      website_url: null,
    });
  }

  return leads;
}

function generatePhoneNumber(country: string): string {
  if (country === "IN") {
    const areaCode = Math.floor(Math.random() * 90000) + 10000;
    const number = Math.floor(Math.random() * 9000000) + 1000000;
    return `+91${areaCode}${number}`;
  } else {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000000) + 1000000;
    return `+1${areaCode}${number}`;
  }
}

function generatePersonalizedPitch(lead: any): { subject: string; body: string } {
  const industryPitches: Record<string, { subject: string; body: string }> = {
    dental: {
      subject: `Get More Patients Online - Professional Website for ${lead.business_name}`,
      body: `Hi ${lead.business_name},

We help dental practices like yours get found online and book more appointments through professional websites.

Most patients search for dentists online first. A professional website helps you:
✓ Show up in local searches
✓ Display your services and team
✓ Let patients book appointments online
✓ Build trust with potential patients

We build affordable, mobile-friendly websites in 2-4 days.

Website starting at: ₹3,500 (India) / $70 (International)

Interested in a quick chat? Reply to this email.

Best regards,
EasyGoAI Team`,
    },
    salon: {
      subject: `Grow Your Salon with an Online Booking Website - ${lead.business_name}`,
      body: `Hi ${lead.business_name},

Most beauty-conscious customers look for salons online. A professional website helps you:
✓ Show your services and pricing
✓ Let customers book appointments online
✓ Display your portfolio and customer reviews
✓ Build your brand presence

We create beautiful salon websites in 2-4 days, affordable pricing.

Starting at: ₹3,500 (India) / $70 (International)

Let's talk about growing your salon online. Reply here!

Best regards,
EasyGoAI Team`,
    },
    lawyer: {
      subject: `Build Your Law Firm's Online Presence - ${lead.business_name}`,
      body: `Hi ${lead.business_name},

Clients search for lawyers online. A professional website builds credibility and attracts clients.

Your legal practice deserves:
✓ Professional online presence
✓ Clear service descriptions
✓ Easy client contact methods
✓ Mobile accessibility

We specialize in professional websites for law firms, built in 2-4 days.

Affordable legal website: ₹3,500 (India) / $70 (International)

Interested? Let's discuss your needs.

Best regards,
EasyGoAI Team`,
    },
    restaurant: {
      subject: `Increase Orders - Professional Website for ${lead.business_name}`,
      body: `Hi ${lead.business_name},

Hungry customers search for restaurants online. A professional website helps you:
✓ Show your menu and pricing
✓ Display your location and hours
✓ Get online orders and reservations
✓ Showcase your best dishes

We build appetizing restaurant websites in 2-4 days, affordable pricing.

Starting at: ₹3,500 (India) / $70 (International)

Let's get your restaurant online. Reach out!

Best regards,
EasyGoAI Team`,
    },
  };

  const industryName = lead.industry || "business";
  const pitch = industryPitches[industryName] || industryPitches.dental;

  return {
    subject: pitch.subject.replace("${lead.business_name}", lead.business_name),
    body: pitch.body.replace("Hi ${lead.business_name}", `Hi ${lead.business_name}`),
  };
}
