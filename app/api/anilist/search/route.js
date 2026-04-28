export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const SEARCH_QUERY = `
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

export async function GET(request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ error: "Informe ?q=nome-do-anime." }, { status: 400 });
  }

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query } }),
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
      results: data.data?.Page?.media || [],
    });
  } catch {
    return Response.json({ error: "Nao foi possivel conectar ao AniList." }, { status: 502 });
  }
}
