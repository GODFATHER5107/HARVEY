"use client";

import { useEffect, useState } from "react";

import {
  Search,
  Users,
  Target,
  Download,
  Globe,
  Building2,
  Mail,
  ExternalLink,
  Trash2,
  Sparkles,
  LayoutDashboard,
  RefreshCw
} from "lucide-react";

type Lead = {
  id: string;
  company: string;
  website: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  industry: string;
  address: string;
  score: number;
  source: string;
  status: string;
};

const countries = [
  "USA",
  "Canada",
  "UK",
  "Ireland",
  "Malta",

  "Australia",
  "New Zealand",
  "Fiji",
  "Papua New Guinea",

  "UAE",

  "India",
  "Singapore",
  "Philippines",
  "Malaysia",

  "Jamaica",
  "Trinidad and Tobago",
  "Barbados",
  "Bahamas",
  "Belize",
  "Guyana"
];

const industries = [
  "All",
  "Healthcare",
  "Technology",
  "Hospitality",
  "Retail",
  "Professional",
  "Manufacturing"
];

const services = [
  "Custom Software Development",
  "Web Development",
  "Mobile App Development",
  "AI Development",
  "AI Chatbots",
  "LLM Development",
  "Blockchain",
  "Dedicated Development Teams",
  "Cloud and DevOps",
  "IT Consulting",
  "Government IT Projects"
];

export default function Home() {

  const [leads, setLeads] = useState<Lead[]>([]);
  const [country, setCountry] = useState("USA");
  const [city, setCity] = useState("New York");
  const [industry, setIndustry] = useState("All");

  const [service, setService] = useState(services[0]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("harvey_leads");

    if (saved) {
      try {
        setLeads(JSON.parse(saved));
      } catch {
        localStorage.removeItem("harvey_leads");
      }
    }
  }, []);

  function saveLeads(data: Lead[]) {
    setLeads(data);

    localStorage.setItem(
      "harvey_leads",
      JSON.stringify(data)
    );
  }

  async function searchLeads() {

    if (!city.trim()) {
      setMessage("Please enter a city.");
      return;
    }

    setLoading(true);
    setMessage("HARVEY is searching for businesses...");

    try {

      const params = new URLSearchParams({
        country,
        city,
        industry
      });

      const response = await fetch(
        `/api/leads?${params.toString()}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Search failed");
      }

      const existing = new Set(
        leads.map(lead => lead.id)
      );

      const fresh = result.leads.filter(
        (lead: Lead) => !existing.has(lead.id)
      );

      saveLeads([...leads, ...fresh]);

      setMessage(
        `${fresh.length} new businesses discovered.`
      );

    } catch (error) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );

    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {

    if (!leads.length) {
      alert("No leads available to export.");
      return;
    }

    const headers = [
      "Company",
      "Website",
      "Email",
      "Phone",
      "Country",
      "City",
      "Industry",
      "Score",
      "Status",
      "Source"
    ];

    const rows = leads.map(lead => [
      lead.company,
      lead.website,
      lead.email,
      lead.phone,
      lead.country,
      lead.city,
      lead.industry,
      lead.score,
      lead.status,
      lead.source
    ]);

    const csv = [
      headers,
      ...rows
    ].map(row =>
      row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "HARVEY-InfoDart-Leads.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function generateEmail(lead: Lead) {

    const subject =
      `Technology Partnership Opportunity - ${lead.company}`;

    const body = `
Hello,

I am reaching out from InfoDart Global.

We provide technology solutions including:

- Custom Software Development
- Web Development
- Mobile Applications
- AI and LLM Development
- AI Chatbots
- Blockchain Solutions
- Dedicated Development Teams

We would welcome the opportunity to understand your upcoming technology requirements.

Would you be available for a brief introductory conversation?

Best regards,
Business Development Team
InfoDart Global
https://www.infodartglobal.com
`;

    const url =
      `mailto:${lead.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = url;
  }

  function deleteLead(id: string) {
    saveLeads(
      leads.filter(lead => lead.id !== id)
    );
  }

  function updateStatus(id: string, status: string) {
    saveLeads(
      leads.map(lead =>
        lead.id === id
          ? { ...lead, status }
          : lead
      )
    );
  }

  const hotLeads = leads.filter(
    lead => lead.score >= 70
  ).length;

  const websites = leads.filter(
    lead => lead.website
  ).length;

  const emails = leads.filter(
    lead => lead.email
  ).length;

  return (

    <main className="min-h-screen bg-[#080d19] text-white">

      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-slate-800 bg-[#0d1525] p-6 lg:block">

        <div className="mb-12">

          <h1 className="text-3xl font-bold tracking-widest text-blue-400">
            HARVEY
          </h1>

          <p className="mt-2 text-xs text-slate-400">
            AI SALES INTELLIGENCE
          </p>

        </div>

        <div className="space-y-6 text-sm">

          <div className="flex items-center gap-3 text-blue-400">
            <LayoutDashboard size={19} />
            Dashboard
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <Search size={19} />
            Lead Hunter
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <Building2 size={19} />
            Company Research
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <Users size={19} />
            CRM
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <Target size={19} />
            Opportunities
          </div>

        </div>

        <div className="absolute bottom-8 text-xs text-slate-500">
          POWERED BY INFODART GLOBAL
        </div>

      </aside>

      <section className="p-5 lg:ml-64 lg:p-10">

        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">

          <div>
            <h2 className="text-3xl font-bold">
              Sales Intelligence Dashboard
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Your business development command centre.
            </p>
          </div>

          <span className="rounded-full border border-green-700 bg-green-950 px-4 py-2 text-sm text-green-400">
            ● SYSTEM ONLINE
          </span>

        </header>

        {/* STATISTICS */}

        <div className="mb-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

          <Stat
            title="Total Prospects"
            value={leads.length}
            icon={<Users />}
          />

          <Stat
            title="High Score Prospects"
            value={hotLeads}
            icon={<Target />}
          />

          <Stat
            title="Companies With Websites"
            value={websites}
            icon={<Globe />}
          />

          <Stat
            title="Available Business Emails"
            value={emails}
            icon={<Mail />}
          />

        </div>

        {/* LEAD HUNTER */}

        <section className="mb-10 rounded-2xl border border-slate-800 bg-[#111a2c] p-6">

          <div className="mb-7 flex items-center gap-3">

            <Sparkles className="text-blue-400" />

            <div>
              <h3 className="text-xl font-semibold">
                HARVEY Lead Hunter
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Discover potential IT clients.
              </p>
            </div>

          </div>

          <div className="grid gap-5 md:grid-cols-3">

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Target Country
              </label>

              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#080d19] p-3"
              >

                {countries.map(c => (
                  <option key={c}>{c}</option>
                ))}

              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Target City
              </label>

              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Enter city"
                className="w-full rounded-lg border border-slate-700 bg-[#080d19] p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Industry
              </label>

              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#080d19] p-3"
              >

                {industries.map(i => (
                  <option key={i}>{i}</option>
                ))}

              </select>
            </div>

          </div>

          <div className="mt-5">

            <label className="mb-2 block text-sm text-slate-400">
              InfoDart Service to Promote
            </label>

            <select
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080d19] p-3"
            >

              {services.map(s => (
                <option key={s}>{s}</option>
              ))}

            </select>

          </div>

          <button
            onClick={searchLeads}
            disabled={loading}
            className="mt-7 flex items-center justify-center gap-3 rounded-lg bg-blue-600 px-7 py-4 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >

            {loading
              ? <RefreshCw className="animate-spin" />
              : <Search />
            }

            {loading
              ? "Searching Businesses..."
              : "Find Prospective Clients"
            }

          </button>

          {message && (
            <div className="mt-5 rounded-lg bg-blue-950 p-4 text-sm text-blue-300">
              {message}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Data source: OpenStreetMap public business records.
          </p>

        </section>

        {/* PROSPECT DATABASE */}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111a2c]">

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-6">

            <div>
              <h3 className="text-xl font-semibold">
                Prospect Database
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Manage your discovered business prospects.
              </p>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold hover:bg-green-600"
            >
              <Download size={17} />
              Export CSV
            </button>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead className="bg-[#0d1424] text-slate-400">

                <tr>
                  <th className="p-4">Company</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Industry</th>
                  <th className="p-4">Website</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>

              </thead>

              <tbody>

                {leads.map(lead => (

                  <tr
                    key={lead.id}
                    className="border-t border-slate-800 hover:bg-slate-800/40"
                  >

                    <td className="p-4 font-semibold">
                      {lead.company}
                    </td>

                    <td className="p-4 text-slate-400">
                      {lead.city}, {lead.country}
                    </td>

                    <td className="p-4 text-slate-400">
                      {lead.industry}
                    </td>

                    <td className="p-4">

                      {lead.website ? (

                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-blue-400"
                        >
                          Visit
                          <ExternalLink size={13} />
                        </a>

                      ) : (
                        "Unavailable"
                      )}

                    </td>

                    <td className="p-4">

                      <span className="rounded-lg bg-blue-950 px-3 py-2 text-blue-300">
                        {lead.score}/100
                      </span>

                    </td>

                    <td className="p-4">

                      <select
                        value={lead.status}
                        onChange={e =>
                          updateStatus(lead.id, e.target.value)
                        }
                        className="rounded-lg border border-slate-700 bg-[#080d19] p-2 text-xs"
                      >

                        <option>New</option>
                        <option>Qualified</option>
                        <option>Contacted</option>
                        <option>Interested</option>
                        <option>Meeting Booked</option>
                        <option>Won</option>
                        <option>Lost</option>

                      </select>

                    </td>

                    <td className="p-4">

                      <div className="flex gap-3">

                        <button
                          onClick={() => generateEmail(lead)}
                          title="Generate email"
                          className="text-green-400"
                        >
                          <Mail size={18} />
                        </button>

                        <a
                          href={lead.source}
                          target="_blank"
                          rel="noreferrer"
                          title="Verify source"
                          className="text-blue-400"
                        >
                          <ExternalLink size={18} />
                        </a>

                        <button
                          onClick={() => deleteLead(lead.id)}
                          title="Delete lead"
                          className="text-red-400"
                        >
                          <Trash2 size={18} />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

                {!leads.length && (

                  <tr>
                    <td
                      colSpan={7}
                      className="p-16 text-center text-slate-500"
                    >
                      <Search className="mx-auto mb-4" size={35} />

                      No prospects discovered yet.

                      <p className="mt-2 text-xs">
                        Start your first search above.
                      </p>

                    </td>
                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>

        <footer className="mt-10 text-center text-xs text-slate-600">
          HARVEY AI SALES AGENT · INFODART GLOBAL
        </footer>

      </section>

    </main>
  );
}

function Stat({
  title,
  value,
  icon
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {

  return (

    <div className="rounded-xl border border-slate-800 bg-[#111a2c] p-6">

      <div className="mb-4 flex items-center justify-between text-slate-400">

        {title}

        <span className="text-blue-400">
          {icon}
        </span>

      </div>

      <div className="text-3xl font-bold">
        {value}
      </div>

    </div>

  );
}
