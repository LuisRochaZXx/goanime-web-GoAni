"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const fallbackAnime = [
  {
    id: "fallback-1",
    title: "Frieren: Beyond Journey's End",
    coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-gHSraOSa0nBG.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-lYFSu1jNQ2e0.jpg",
    genres: ["Adventure", "Drama", "Fantasy"],
    episodes: 28,
    score: 91,
    status: "Finished",
    source: "AniList",
  },
  {
    id: "fallback-2",
    title: "Solo Leveling",
    coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-YUZp9Yk0YfN9.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-0v5JjGQKqWZx.jpg",
    genres: ["Action", "Adventure", "Fantasy"],
    episodes: 12,
    score: 83,
    status: "Finished",
    source: "AniList",
  },
  {
    id: "fallback-3",
    title: "One Piece",
    coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-O6vMCSqzW4k4.jpg",
    genres: ["Action", "Adventure", "Comedy"],
    episodes: null,
    score: 88,
    status: "Releasing",
    source: "AniList",
  },
  {
    id: "fallback-4",
    title: "Demon Slayer: Kimetsu no Yaiba",
    coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-YfZhKBUDDS6L.jpg",
    genres: ["Action", "Adventure", "Supernatural"],
    episodes: 26,
    score: 84,
    status: "Finished",
    source: "AniList",
  },
];

const statusLabel = {
  RELEASING: "Lancando",
  FINISHED: "Finalizado",
  NOT_YET_RELEASED: "Em breve",
  CANCELLED: "Cancelado",
  HIATUS: "Pausado",
  Releasing: "Lancando",
  Finished: "Finalizado",
};

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-white/80 transition hover:border-cyan-300/40 hover:bg-white/[0.12] hover:text-white ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M8 5.8v12.4c0 .8.9 1.3 1.6.9l9.7-6.2a1.1 1.1 0 0 0 0-1.8L9.6 4.9C8.9 4.5 8 5 8 5.8Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="m12 2.6 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.6 3 1.1-6.2L3 9.2l6.2-.9L12 2.6Z" />
    </svg>
  );
}

function normalizeAnime(item) {
  const title =
    item?.title?.romaji ||
    item?.title?.english ||
    item?.title?.native ||
    item?.title ||
    item?.Name ||
    item?.name ||
    "Anime sem titulo";
  const detailsCover = item?.Details?.CoverImage?.Large || item?.Details?.CoverImage?.Medium;

  return {
    ...item,
    id: item.id || item.ID || item.slug || item.URL || title,
    title,
    coverImage: item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage || item.ImageURL || detailsCover || item.image || "",
    bannerImage: item.bannerImage || item.coverImage?.extraLarge || item.ImageURL || detailsCover || item.image || "",
    genres: item.genres || item.Details?.Genres || [],
    episodes: item.episodes ?? item.totalEpisodes ?? item.Details?.Episodes ?? null,
    score: item.averageScore ?? item.score ?? item.Details?.AverageScore ?? null,
    status: statusLabel[item.status] || item.status || "Disponivel",
    description: item.description || item.Details?.Description || "",
    goanimeId: item.goanimeId || item.id || null,
    source: item.Source || item.source || "AniList",
  };
}

function VideoPlayer({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream?.url) return;

    let hls;
    const playbackUrl = stream.headers?.Referer
      ? `/api/goanime?action=proxy&url=${encodeURIComponent(stream.url)}`
      : stream.url;
    const isHls = stream.type === "hls" || stream.url.includes(".m3u8");

    async function attach() {
      if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playbackUrl;
        return;
      }

      if (!window.Hls) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/hls.js@1";
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      hls = new window.Hls();
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
    }

    attach().catch(() => {
      video.src = playbackUrl;
    });

    return () => {
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [stream]);

  if (!stream?.url) return null;

  return (
    <div className="mt-6">
      <video ref={videoRef} controls playsInline className="aspect-video w-full rounded-lg bg-black" />
      <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
        Stream {stream.quality || "best"} - {stream.type || "unknown"}{stream.headers?.Referer ? " via proxy com Referer" : ""}.
      </div>
    </div>
  );
}

function AnimeCard({ anime, onOpen }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.07]">
      <button onClick={() => onOpen(anime)} className="block w-full text-left">
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          {anime.coverImage ? (
            <img
              src={anime.coverImage}
              alt={`Capa de ${anime.title}`}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center bg-slate-900 px-4 text-center text-sm font-bold text-white/50">
              {anime.title}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 to-transparent" />
          <span className="absolute left-3 top-3 rounded bg-cyan-400 px-2 py-1 text-[11px] font-black uppercase text-slate-950">
            {anime.source}
          </span>
          {anime.score ? (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-bold text-amber-200">
              <StarIcon /> {anime.score}%
            </span>
          ) : null}
        </div>
        <div className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">{anime.status}</p>
          <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-black leading-snug">{anime.title}</h3>
          <p className="mt-2 line-clamp-1 text-sm text-white/55">
            {anime.episodes ? `${anime.episodes} eps` : "Episodios"} {anime.genres?.length ? `- ${anime.genres.slice(0, 2).join(", ")}` : ""}
          </p>
        </div>
      </button>
    </article>
  );
}

function DetailsPanel({ anime, episodes, episodesLoading, stream, streamLoading, error, onClose, onLoadEpisodes, onPlayEpisode }) {
  if (!anime) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-5xl items-center">
        <div className="relative max-h-full w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1020] shadow-2xl shadow-black">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm font-bold hover:bg-black/70"
          >
            Fechar
          </button>
          <div className="grid md:grid-cols-[320px_1fr]">
            <div className="relative min-h-80 bg-slate-900">
              {anime.coverImage ? <img src={anime.coverImage} alt="" className="h-full w-full object-cover" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] via-transparent to-transparent md:hidden" />
            </div>
            <div className="p-6 md:p-8">
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">{anime.source} metadata</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">{anime.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {(anime.genres || []).slice(0, 5).map((genre) => (
                  <span key={genre} className="rounded bg-white/[0.08] px-3 py-1 text-sm text-white/75">
                    {genre}
                  </span>
                ))}
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-white/65">
                {anime.description
                  ? anime.description.replace(/<[^>]*>/g, "")
                  : anime.source === "AniList"
                    ? "Dados vindos do AniList. Ao carregar episodios, o site procura o mesmo titulo nas fontes GoAnime."
                    : "Resultado vindo do GoAnime. Carregue os episodios para resolver um stream e abrir o player."}
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/45">Status</p>
                  <p className="mt-1 font-black">{anime.status}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/45">Episodios</p>
                  <p className="mt-1 font-black">{anime.episodes || "A confirmar"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/45">Nota</p>
                  <p className="mt-1 font-black">{anime.score ? `${anime.score}%` : "Sem nota"}</p>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={`https://anilist.co/search/anime?search=${encodeURIComponent(anime.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
                >
                  <SearchIcon /> Ver no AniList
                </a>
                <button
                  onClick={() => onLoadEpisodes(anime)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white/80"
                >
                  <PlayIcon /> Episodios via API
                </button>
              </div>
              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">Episodios GoAnime</h3>
                  <button
                    onClick={() => onLoadEpisodes(anime)}
                    className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300"
                  >
                    {episodesLoading ? "Carregando" : "Carregar episodios"}
                  </button>
                </div>
                {error ? <p className="mb-3 text-sm font-semibold text-rose-200">{error}</p> : null}
                <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
                  {episodes.map((episode) => (
                    <button
                      key={episode.URL || episode.Number || episode.Num}
                      onClick={() => onPlayEpisode(episode)}
                      className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left text-sm hover:bg-white/[0.06]"
                    >
                      <span className="font-bold">Episodio {episode.Number || episode.Num}</span>
                      <span className="text-white/45">{streamLoading ? "resolvendo..." : "Assistir"}</span>
                    </button>
                  ))}
                  {!episodes.length && !episodesLoading ? (
                    <div className="px-4 py-6 text-sm text-white/50">Carregue os episodios para testar o player.</div>
                  ) : null}
                </div>
                <VideoPlayer stream={stream} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [anime, setAnime] = useState(fallbackAnime.map(normalizeAnime));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [stream, setStream] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const hero = anime[0] || fallbackAnime[0];
  const schedule = useMemo(() => anime.slice(0, 5), [anime]);

  async function loadAnime(searchTerm = "") {
    setLoading(true);
    setError("");

    try {
      const endpoint = searchTerm.trim()
        ? `/api/goanime?action=search&q=${encodeURIComponent(searchTerm.trim())}`
        : "/api/anilist/trending";
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar os animes.");

      const items = Array.isArray(data.results) ? data.results : [];
      setAnime(items.length ? items.map(normalizeAnime) : fallbackAnime.map(normalizeAnime));
    } catch (err) {
      setError(err.message);
      setAnime(fallbackAnime.map(normalizeAnime));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAnime();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    loadAnime(query);
  }

  function openAnime(anime) {
    setSelected(anime);
    setSelectedEpisodes([]);
    setStream(null);
    setPlayerError("");
  }

  async function loadEpisodes(animeToLoad = selected) {
    if (!animeToLoad) return;
    setEpisodesLoading(true);
    setPlayerError("");
    setStream(null);

    try {
      let goAnimeItem = animeToLoad;

      if (!goAnimeItem.URL || goAnimeItem.source === "AniList" || goAnimeItem.Source === "AniList") {
        const searchResponse = await fetch(`/api/goanime?action=search&q=${encodeURIComponent(goAnimeItem.title || goAnimeItem.Name)}`);
        const searchData = await searchResponse.json();
        if (!searchResponse.ok) throw new Error(searchData?.error || "Nao foi possivel achar esse anime no GoAnime.");

        goAnimeItem = searchData.results?.[0];
        if (!goAnimeItem) throw new Error("Nenhum resultado GoAnime encontrado para esse titulo.");
        setSelected(normalizeAnime(goAnimeItem));
      }

      const response = await fetch("/api/goanime?action=episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goAnimeItem),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar episodios.");
      setSelectedEpisodes(data.episodes || []);
    } catch (err) {
      setPlayerError(err.message);
    } finally {
      setEpisodesLoading(false);
    }
  }

  async function playEpisode(episode) {
    if (!selected) return;
    setStreamLoading(true);
    setPlayerError("");

    try {
      const response = await fetch("/api/goanime?action=stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anime: selected, episode, quality: "best", mode: "sub" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel resolver o stream.");
      setStream(data);
    } catch (err) {
      setPlayerError(err.message);
    } finally {
      setStreamLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b16] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080b16]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="#" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40">
              <PlayIcon />
            </span>
            <span>
              <span className="block text-xl font-black leading-none">GoAnime Web</span>
              <span className="block text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">AniList + API</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-white/65 md:flex">
            <a href="#buscar" className="hover:text-white">Buscar</a>
            <a href="#temporada" className="hover:text-white">Temporada</a>
            <a href="#calendario" className="hover:text-white">Calendario</a>
          </nav>
          <div className="flex items-center gap-2">
            <IconButton label="Pesquisar" onClick={() => document.getElementById("search-input")?.focus()}>
              <SearchIcon />
            </IconButton>
            <IconButton label="Menu" className="md:hidden">
              <MenuIcon />
            </IconButton>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        {hero.bannerImage || hero.coverImage ? (
          <img src={hero.bannerImage || hero.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080b16] via-[#080b16]/86 to-[#080b16]/42" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080b16] via-transparent to-transparent" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_340px] md:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex rounded bg-cyan-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
              Temporada e busca em tempo real
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">GoAnime Web</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/72">
              Um front-end pronto para Vercel com capas e metadados do AniList, busca centralizada e rota preparada para conectar seu backend GoAnime.
            </p>

            <form id="buscar" onSubmit={submitSearch} className="mt-7 flex max-w-2xl gap-2 rounded-lg border border-white/10 bg-black/40 p-2">
              <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <SearchIcon />
                <input
                  id="search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar anime..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                />
              </label>
              <button className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">
                {loading ? "Buscando" : "Buscar"}
              </button>
            </form>
            {error ? <p className="mt-3 text-sm font-semibold text-rose-200">{error}</p> : null}
          </div>

          <button onClick={() => openAnime(hero)} className="group hidden overflow-hidden rounded-lg border border-white/10 bg-white/[0.05] text-left shadow-2xl shadow-black/30 md:block">
            <div className="aspect-[2/3] overflow-hidden">
              <img src={hero.coverImage} alt={`Capa de ${hero.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase text-cyan-200">Destaque</p>
              <p className="mt-1 line-clamp-2 font-black">{hero.title}</p>
            </div>
          </button>
        </div>
      </section>

      <section id="temporada" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-cyan-200"><StarIcon /> Catalogo</p>
            <h2 className="mt-2 text-3xl font-black">Animes encontrados</h2>
          </div>
          <button onClick={() => loadAnime()} className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold hover:bg-white/[0.1]">
            Atualizar
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {anime.map((item) => (
            <AnimeCard key={`${item.source}-${item.id}`} anime={item} onOpen={openAnime} />
          ))}
        </div>
      </section>

      <section id="calendario" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-cyan-200">Proximos para assistir</p>
              <h2 className="mt-1 text-2xl font-black">Fila rapida</h2>
            </div>
            <span className="rounded bg-white/[0.08] px-3 py-1 text-sm text-white/65">{schedule.length} itens</span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {schedule.map((item, index) => (
              <button key={`${item.id}-${index}`} onClick={() => openAnime(item)} className="rounded-lg border border-white/10 bg-black/25 p-4 text-left hover:bg-black/40">
                <p className="text-xs font-bold uppercase text-white/40">Posicao {index + 1}</p>
                <h3 className="mt-2 line-clamp-2 min-h-12 font-black">{item.title}</h3>
                <p className="mt-3 text-sm text-white/55">{item.episodes ? `${item.episodes} eps` : "Episodios"}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <DetailsPanel
        anime={selected}
        episodes={selectedEpisodes}
        episodesLoading={episodesLoading}
        stream={stream}
        streamLoading={streamLoading}
        error={playerError}
        onClose={() => setSelected(null)}
        onLoadEpisodes={loadEpisodes}
        onPlayEpisode={playEpisode}
      />
    </main>
  );
}
