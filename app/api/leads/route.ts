```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNTRIES: Record<string, string> = {
  USA: "United States",
  UK: "United Kingdom",
  Canada: "Canada",
  Australia: "Australia",
  UAE: "United Arab Emirates"
};

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

type OSMElement = {
  id: number;
  type: string;
  tags?: Record<string, string>;
  center?: {
    lat: number;
    lon: number;
  };
};

function normalizeWebsite(value?: string) {
  if (!value) return "";

  const website = value.trim();

  if (!website) return "";

  return /^https?:\/\//i.test(website)
    ? website
    : `https://${website}`;
}

function getIndustry(tags: Record<string, string>) {
  if (tags.industrial) return "Manufacturing";
  if (tags.shop) return "Retail";

  if (
    tags.amenity === "hospital" ||
    tags.amenity === "clinic" ||
    tags.amenity === "doctors"
  ) {
    return "Healthcare";
  }

  if (tags.tourism) return "Hospitality";

  if (tags.office === "it" || tags.office === "software") {
    return "Technology";
  }

  if (tags.office) return "Professional";

  return "Business";
}

function matchesIndustry(
  tags: Record<string, string>,
  selected: string
) {
  if (selected === "All") return true;

  const category = getIndustry(tags);

  if (selected === "Technology") {
    return (
      category === "Technology" ||
      tags.office === "company" ||
      tags.office === "coworking"
    );
  }

  return category === selected;
}

function scoreLead(tags: Record<string, string>) {
  let score = 25;

  if (tags.website || tags["contact:website"]) score += 20;
  if (tags.phone || tags["contact:phone"]) score += 10;
  if (tags.email || tags["contact:email"]) score += 15;
  if (tags.office) score += 10;
  if (tags.industry) score += 10;
  if (tags["addr:street"]) score += 5;

  return Math.min(score, 100);
}

async function discoverLocation(city: string, country: string) {
  const url = new URL(
    "https://nominatim.openstreetmap.org/search"
  );

  url.searchParams.set("city", city);
  url.searchParams.set("country", country);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "HARVEY-InfoDart-LeadDiscovery/1.0"
    },
    signal: AbortSignal.timeout(10000),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Location service unavailable.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error(
      `Could not find ${city}, ${country}.`
    );
  }

  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon)
  };
}

function buildQuery(lat: number, lon: number) {
  // Approximately 5 km around the selected city centre.

  const radius = 0.045;

  const south = lat - radius;
  const north = lat + radius;
  const west = lon - radius;
  const east = lon + radius;

  const box = `${south},${west},${north},${east}`;

  return `
    [out:json][timeout:20];

    (
      nwr["name"]["office"](${box});
      nwr["name"]["shop"](${box});
      nwr["name"]["industrial"](${box});

      nwr["name"]["amenity"~"hospital|clinic|doctors|university|school"](${box});

      nwr["name"]["tourism"~"hotel|motel|guest_house"](${box});

      nwr["name"]["website"](${box});
      nwr["name"]["contact:website"](${box});
    );

    out center tags 100;
  `;
}

async function searchOverpass(query: string) {
  let lastError = "All public business search servers are unavailable.";

  for (const server of OVERPASS_SERVERS) {
    try {
      const response = await fetch(server, {
        method: "POST",

        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "HARVEY-InfoDart-LeadDiscovery/1.0"
        },

        body: new URLSearchParams({
          data: query
        }),

        signal: AbortSignal.timeout(15000),

        cache: "no-store"
      });

      if (!response.ok) {
        lastError = `Search server returned ${response.status}`;
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data.elements)) {
        lastError = "Invalid business search response.";
        continue;
      }

      return data.elements as OSMElement[];

    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Search server failed.";
    }
  }

  throw new Error(lastError);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const country = params.get("country") || "USA";
    const city = params.get("city") || "New York";
    const industry = params.get("industry") || "All";

    if (!COUNTRIES[country]) {
      return NextResponse.json(
        { error: "Unsupported country." },
        { status: 400 }
      );
    }

    if (!city.trim() || city.length > 100) {
      return NextResponse.json(
        { error: "Please enter a valid city." },
        { status: 400 }
      );
    }

    // 1. Find the city.

    const location = await discoverLocation(
      city,
      COUNTRIES[country]
    );

    // 2. Build the business search.

    const query = buildQuery(
      location.lat,
      location.lon
    );

    // 3. Search multiple public servers.

    const elements = await searchOverpass(query);

    // 4. Convert records into business prospects.

    const leads = elements
      .filter(element => element.tags?.name)
      .filter(element =>
        matchesIndustry(
          element.tags || {},
          industry
        )
      )
      .map(element => {
        const tags = element.tags || {};

        const website = normalizeWebsite(
          tags.website || tags["contact:website"]
        );

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

          website,

          email,

          phone,

          country,

          city,

          industry: getIndustry(tags),

          address: [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:city"]
          ]
            .filter(Boolean)
            .join(", "),

          score: scoreLead(tags),

          source:
            `https://www.openstreetmap.org/${element.type}/${element.id}`,

          status: "New",

          verified: true
        };
      });

    // 5. Remove duplicates.

    const unique = Array.from(
      new Map(
        leads.map(lead => [lead.id, lead])
      ).values()
    );

    return NextResponse.json({
      success: true,

      total: unique.length,

      leads: unique,

      country,

      city,

      industry,

      source: "OpenStreetMap",

      message: unique.length
        ? `${unique.length} businesses discovered.`
        : "No matching businesses found in this search area."
    });

  } catch (error) {
    console.error("HARVEY DISCOVERY ERROR:", error);

    return NextResponse.json(
      {
        success: false,

        leads: [],

        error:
          error instanceof Error
            ? error.message
            : "Lead discovery failed."
      },
      { status: 503 }
    );
  }
}
```
