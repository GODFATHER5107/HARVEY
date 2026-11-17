import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COUNTRIES: Record<string, string> = {
  USA: "United States",
  UK: "United Kingdom",
  Canada: "Canada",
  Australia: "Australia",
  UAE: "United Arab Emirates"
};

const INDUSTRIES: Record<string, string[]> = {
  All: [],
  Healthcare: [
    '["amenity"~"hospital|clinic|doctors|dentist"]'
  ],
  Technology: [
    '["office"~"company|it|software"]'
  ],
  Hospitality: [
    '["tourism"~"hotel|motel|guest_house"]'
  ],
  Retail: [
    '["shop"]'
  ],
  Professional: [
    '["office"~"company|lawyer|accountant|consulting"]'
  ],
  Manufacturing: [
    '["industrial"]',
    '["craft"]'
  ]
};

function scoreLead(tags: Record<string, string>) {
  let score = 30;

  if (tags.website || tags["contact:website"]) score += 20;
  if (tags.phone || tags["contact:phone"]) score += 10;
  if (tags.email || tags["contact:email"]) score += 10;
  if (tags.office) score += 10;
  if (tags.industry) score += 10;

  return Math.min(score, 100);
}

function getIndustry(tags: Record<string, string>) {
  return (
    tags.industry ||
    tags.office ||
    tags.amenity ||
    tags.shop ||
    tags.tourism ||
    tags.craft ||
    "Business"
  );
}

function normalizeWebsite(value: string) {
  if (!value) return "";

  return /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const country = params.get("country") || "USA";
    const city = params.get("city") || "New York";
    const industry = params.get("industry") || "All";

    if (!COUNTRIES[country]) {
      return NextResponse.json(
        { error: "Unsupported country" },
        { status: 400 }
      );
    }

    if (!city.trim() || city.length > 100) {
      return NextResponse.json(
        { error: "Please enter a valid city" },
        { status: 400 }
      );
    }

    const countryName = COUNTRIES[country];

    const geoURL = new URL(
      "https://nominatim.openstreetmap.org/search"
    );

    geoURL.searchParams.set("city", city);
    geoURL.searchParams.set("country", countryName);
    geoURL.searchParams.set("format", "jsonv2");
    geoURL.searchParams.set("limit", "1");

    const geoResponse = await fetch(geoURL, {
      headers: {
        "User-Agent": "HARVEY-InfoDart-LeadDiscovery/1.0"
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store"
    });

    if (!geoResponse.ok) {
      throw new Error("Location service unavailable");
    }

    const locations = await geoResponse.json();

    if (!locations.length) {
      return NextResponse.json({
        leads: [],
        total: 0,
        message: "Location not found."
      });
    }

    const lat = Number(locations[0].lat);
    const lon = Number(locations[0].lon);

    const south = lat - 0.12;
    const north = lat + 0.12;
    const west = lon - 0.12;
    const east = lon + 0.12;

    const bbox = `${south},${west},${north},${east}`;

    const filters = INDUSTRIES[industry] ?? [];

    const selectors = filters.length
      ? filters.map(
          filter =>
            `nwr["name"]["website"]${filter}(${bbox});`
        )
      : [
          `nwr["name"]["website"](${bbox});`,
          `nwr["name"]["contact:website"](${bbox});`
        ];

    const query = `
      [out:json][timeout:25];

      (
        ${selectors.join("\n")}
      );

      out center tags;
    `;

    const response = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "HARVEY-InfoDart-LeadDiscovery/1.0"
        },
        body: new URLSearchParams({
          data: query
        }),
        signal: AbortSignal.timeout(35000),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Business discovery service unavailable. Please retry."
      );
    }

    const data = await response.json();

    const leads = data.elements.map((element: any) => {
      const tags = element.tags || {};

      const website =
        tags.website || tags["contact:website"] || "";

      const email =
        tags.email || tags["contact:email"] || "";

      const phone =
        tags.phone || tags["contact:phone"] || "";

      return {
        id: `${element.type}-${element.id}`,
        company: tags.name || "Unknown",
        website: normalizeWebsite(website),
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
        source: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        status: "New",
        verified: true
      };
    });

    const unique = Array.from(
      new Map(
        leads.map((lead: any) => [lead.id, lead])
      ).values()
    );

    return NextResponse.json({
      success: true,
      total: unique.length,
      leads: unique,
      country,
      city,
      industry
    });

  } catch (error) {
    console.error("HARVEY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Lead discovery failed."
      },
      { status: 500 }
    );
  }
}
