import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ==========================================
// HARVEY GLOBAL COUNTRY CONFIGURATION
// ==========================================

const ALLOWED_COUNTRIES: Record<string, string> = {
  USA: "United States",
  Canada: "Canada",
  UK: "United Kingdom",
  Ireland: "Ireland",
  Malta: "Malta",

  Australia: "Australia",
  "New Zealand": "New Zealand",
  Fiji: "Fiji",
  "Papua New Guinea": "Papua New Guinea",

  UAE: "United Arab Emirates",

  India: "India",
  Singapore: "Singapore",
  Philippines: "Philippines",
  Malaysia: "Malaysia",

  Jamaica: "Jamaica",
  "Trinidad and Tobago": "Trinidad and Tobago",
  Barbados: "Barbados",
  Bahamas: "Bahamas",
  Belize: "Belize",
  Guyana: "Guyana"
};

// Only countries in ALLOWED_COUNTRIES can be searched.
// All other countries are automatically rejected.

// ==========================================
// SEARCH SERVERS
// ==========================================

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

// ==========================================
// INDUSTRY CLASSIFICATION
// ==========================================

function getIndustry(tags: Record<string, string>) {

  if (tags.industrial) return "Manufacturing";

  if (tags.shop) return "Retail";

  if (
    ["hospital", "clinic", "doctors"].includes(
      tags.amenity || ""
    )
  ) {
    return "Healthcare";
  }

  if (tags.tourism) return "Hospitality";

  if (
    ["it", "software"].includes(tags.office || "")
  ) {
    return "Technology";
  }

  if (tags.office) return "Professional";

  return "Business";
}

// ==========================================
// LEAD SCORING
// ==========================================

function scoreLead(tags: Record<string, string>) {

  let score = 25;

  if (tags.website || tags["contact:website"])
    score += 20;

  if (tags.email || tags["contact:email"])
    score += 15;

  if (tags.phone || tags["contact:phone"])
    score += 10;

  if (tags.office)
    score += 10;

  if (tags.industry)
    score += 10;

  if (tags["addr:street"])
    score += 5;

  return Math.min(score, 100);
}

// ==========================================
// LOCATION DISCOVERY
// ==========================================

async function discoverLocation(
  city: string,
  country: string
) {

  const url = new URL(
    "https://nominatim.openstreetmap.org/search"
  );

  url.searchParams.set("city", city);
  url.searchParams.set("country", country);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "HARVEY-InfoDart-Global/2.0"
    },
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Location discovery service unavailable.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error(
      `Location ${city}, ${country} was not found.`
    );
  }

  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon)
  };
}

// ==========================================
// INDUSTRY FILTERS
// ==========================================

function industryQuery(
  industry: string,
  box: string
) {

  const filters: Record<string, string> = {

    All: `
      nwr["name"]["office"](${box});
      nwr["name"]["shop"](${box});
      nwr["name"]["industrial"](${box});
      nwr["name"]["website"](${box});
      nwr["name"]["contact:website"](${box});
    `,

    Technology: `
      nwr["name"]["office"~"it|software|company|consulting"](${box});
      nwr["name"]["website"](${box});
    `,

    Healthcare: `
      nwr["name"]["amenity"~"hospital|clinic|doctors|dentist"](${box});
    `,

    Hospitality: `
      nwr["name"]["tourism"~"hotel|motel|guest_house"](${box});
    `,

    Retail: `
      nwr["name"]["shop"](${box});
    `,

    Professional: `
      nwr["name"]["office"](${box});
    `,

    Manufacturing: `
      nwr["name"]["industrial"](${box});
    `
  };

  return filters[industry] || filters.All;
}

// ==========================================
// OVERPASS SEARCH
// ==========================================

async function searchBusinesses(
  lat: number,
  lon: number,
  industry: string
) {

  const radius = 0.045;

  const south = lat - radius;
  const north = lat + radius;
  const west = lon - radius;
  const east = lon + radius;

  const box = `${south},${west},${north},${east}`;

  const query = `
    [out:json][timeout:20];

    (
      ${industryQuery(industry, box)}
    );

    out center tags 100;
  `;

  let lastError = "Business search unavailable.";

  for (const server of OVERPASS_SERVERS) {

    try {

      const response = await fetch(server, {

        method: "POST",

        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "HARVEY-InfoDart-Global/2.0"
        },

        body: new URLSearchParams({
          data: query
        }),

        signal: AbortSignal.timeout(18000),

        cache: "no-store"

      });

      if (!response.ok) {
        lastError = `Search server error: ${response.status}`;
        continue;
      }

      const data = await response.json();

      if (Array.isArray(data.elements)) {
        return data.elements;
      }

    } catch (error) {

      lastError =
        error instanceof Error
          ? error.message
          : "Search failed.";

    }
  }

  throw new Error(lastError);
}

// ==========================================
// MAIN API
// ==========================================

export async function GET(request: NextRequest) {

  try {

    const params = request.nextUrl.searchParams;

    const country = params.get("country") || "";
    const city = params.get("city") || "";
    const industry = params.get("industry") || "All";

    // STRICT COUNTRY VALIDATION

    if (!ALLOWED_COUNTRIES[country]) {

      return NextResponse.json({

        success: false,

        error: "This country is not permitted in HARVEY's targeting policy."

      }, { status: 403 });

    }

    if (!city.trim() || city.length > 100) {

      return NextResponse.json({

        success: false,

        error: "Please enter a valid city."

      }, { status: 400 });

    }

    const countryName = ALLOWED_COUNTRIES[country];

    // STEP 1: FIND LOCATION

    const location = await discoverLocation(
      city,
      countryName
    );

    // STEP 2: SEARCH BUSINESSES

    const elements = await searchBusinesses(
      location.lat,
      location.lon,
      industry
    );

    // STEP 3: CREATE LEADS

    const leads = elements

      .filter((element: any) =>
        element.tags?.name
      )

      .map((element: any) => {

        const tags = element.tags || {};

        const website =
          tags.website ||
          tags["contact:website"] ||
          "";

        const email =
          tags.email ||
          tags["contact:email"] ||
          "";

        const phone =
          tags.phone ||
          tags["contact:phone"] ||
          "";

        return {

          id: `${element.type}-${element.id}`,

          company: tags.name,

          website: website
            ? /^https?:\/\//i.test(website)
              ? website
              : `https://${website}`
            : "",

          email,

          phone,

          country,

          city,

          industry: getIndustry(tags),

          address: [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:city"]
          ].filter(Boolean).join(", "),

          score: scoreLead(tags),

          source:
            `https://www.openstreetmap.org/${element.type}/${element.id}`,

          status: "New",

          sourceType: "Business Directory"

        };

      });

    // STEP 4: REMOVE DUPLICATES

    const uniqueLeads = Array.from(

      new Map(
        leads.map((lead: any) => [
          lead.id,
          lead
        ])
      ).values()

    );

    return NextResponse.json({

      success: true,

      total: uniqueLeads.length,

      leads: uniqueLeads,

      country,

      city,

      industry,

      source: "OpenStreetMap",

      targetingPolicy: "Approved Countries Only",

      message:
        `${uniqueLeads.length} business records discovered.`

    });

  } catch (error) {

    console.error("HARVEY GLOBAL ERROR:", error);

    return NextResponse.json({

      success: false,

      leads: [],

      error:
        error instanceof Error
          ? error.message
          : "HARVEY search failed."

    }, { status: 503 });

  }

}
