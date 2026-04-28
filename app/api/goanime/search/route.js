export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ANILIST_SEARCH_QUERY = `
  query SearchAnime($search: String!) {
    Page(page: 1, perPage: 20) {
      media(type: ANIME, search: $search, sort: POPULARITY_DESC) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        genres
        episodes
        averageScore
        status
        description(asHtml: false)
      }
    }
  }
`;

function buildGoAnimeUrl(baseUrl, query) {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  return url;
}

function normalizeGoAnimeResults(payload) {
  const results = payload?.results || payload?.data || payload?.items || [];

  if (!Array.isArray(results)) return [];

  return results.map((item) => ({
    id: item.id || item.slug || item.animeId || item.title || item.name,
    goanimeId: item.id || item.slug || item.animeId || null,
    title: item.title || item.name,
    coverImage: item.image || item.cover || item.coverImage || "",
    bannerImage: item.banner || item.bannerImage || item.image || "",
    episodes: item.episodes || item.totalEpisodes || null,
    status: item.status || "Disponivel",
    genres: item.genres || [],
    source: "GoAnime",
  }));
}

async function searchAniListFallback(query) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: ANILIST_SEARCH_QUERY, variables: { search: query } }),
    next: { revalidate: 900 },
  });
  const data = await response.json();

  if (!response.ok || data.errors) {
    return Response.json(
      { error: data.errors?.[0]?.message || "AniList nao respondeu corretamente." },
      { status: response.status || 502 },
    );
  }

  return Response.json({
    source: "AniList",
    usingFallback: true,
    results: data.data?.Page?.media || [],
  });
}

export async function GET(request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ error: "Informe ?q=nome-do-anime." }, { status: 400 });
  }

  const baseUrl = process.env.GOANIME_API_BASE;

  if (!baseUrl) {
    return searchAniListFallback(query);
  }

  try {
    const response = await fetch(buildGoAnimeUrl(baseUrl, query), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: payload?.error || "GoAnime API nao respondeu corretamente." },
        { status: response.status },
      );
    }

    return Response.json({
      source: "GoAnime",
      results: normalizeGoAnimeResults(payload),
    });
  } catch {
    return Response.json({ error: "Nao foi possivel conectar a GoAnime API." }, { status: 502 });
  }
}
