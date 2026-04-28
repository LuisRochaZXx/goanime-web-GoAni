package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/alvarorichard/Goanime/pkg/goanime"
	"github.com/alvarorichard/Goanime/pkg/goanime/types"
)

type streamResult struct {
	URL      string            `json:"url"`
	Type     string            `json:"type"`
	Headers  map[string]string `json:"headers,omitempty"`
	Meta     map[string]string `json:"meta,omitempty"`
	Quality  string            `json:"quality"`
	Mode     string            `json:"mode"`
	Playable bool              `json:"playable"`
}

type animeFireVideoAPI struct {
	Data []struct {
		Src   string `json:"src"`
		Label string `json:"label"`
	} `json:"data"`
}

type streamRequest struct {
	Anime   *types.Anime   `json:"anime"`
	Episode *types.Episode `json:"episode"`
	Quality string         `json:"quality"`
	Mode    string         `json:"mode"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.URL.Query().Get("action") == "proxy" {
		handleProxy(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	switch r.URL.Query().Get("action") {
	case "search":
		handleSearch(w, r)
	case "episodes":
		handleEpisodes(w, r)
	case "stream":
		handleStream(w, r)
	default:
		writeError(w, http.StatusBadRequest, "use action=search, action=episodes ou action=stream")
	}
}

func handleProxy(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("url"))
	if raw == "" {
		writeError(w, http.StatusBadRequest, "informe url=stream-url")
		return
	}

	target, err := url.Parse(raw)
	if err != nil || target.Scheme != "https" || !isAllowedProxyHost(target.Host) {
		writeError(w, http.StatusBadRequest, "host de stream nao permitido")
		return
	}

	req, err := http.NewRequest(http.MethodGet, raw, nil)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Header.Set("User-Agent", userAgent())
	req.Header.Set("Referer", "https://animefire.io/")
	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := (&http.Client{Timeout: 0}).Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	defer resp.Body.Close()

	copyHeader(w, resp.Header, "Content-Type")
	copyHeader(w, resp.Header, "Content-Length")
	copyHeader(w, resp.Header, "Content-Range")
	copyHeader(w, resp.Header, "Accept-Ranges")
	copyHeader(w, resp.Header, "Cache-Control")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		writeError(w, http.StatusBadRequest, "informe q=nome-do-anime")
		return
	}

	source, err := parseSourceName(firstNonEmpty(r.URL.Query().Get("source"), "AnimeFire"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	results, err := goanime.NewClient().SearchAnime(query, &source)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	for _, anime := range results {
		if parsed, err := parseSourceName(anime.Source); err == nil {
			anime.Source = canonicalSource(parsed)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"source":  canonicalSource(source),
		"results": results,
	})
}

func handleEpisodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "episodes usa POST com o anime em JSON")
		return
	}

	var anime types.Anime
	if err := json.NewDecoder(r.Body).Decode(&anime); err != nil {
		writeError(w, http.StatusBadRequest, "JSON de anime invalido")
		return
	}

	source, err := parseSourceName(anime.Source)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	episodes, err := goanime.NewClient().GetAnimeEpisodes(anime.URL, source)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"source":   canonicalSource(source),
		"anime":    anime,
		"episodes": episodes,
	})
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "stream usa POST com anime e episodio em JSON")
		return
	}

	var payload streamRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "JSON de stream invalido")
		return
	}
	if payload.Anime == nil || payload.Episode == nil {
		writeError(w, http.StatusBadRequest, "anime e episode sao obrigatorios")
		return
	}

	quality := firstNonEmpty(payload.Quality, "best")
	mode := firstNonEmpty(payload.Mode, "sub")
	streamURL, actualQuality, headers, err := resolvePlayableURL(payload.Anime, payload.Episode, quality, mode)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, streamResult{
		URL:      streamURL,
		Type:     streamType(streamURL),
		Headers:  headers,
		Meta:     map[string]string{"source": payload.Anime.Source, "requested_quality": quality},
		Quality:  actualQuality,
		Mode:     mode,
		Playable: streamURL != "",
	})
}

func resolvePlayableURL(anime *types.Anime, episode *types.Episode, quality string, mode string) (string, string, map[string]string, error) {
	source, err := parseSourceName(anime.Source)
	if err != nil {
		return "", "", nil, err
	}
	anime.Source = canonicalSource(source)

	streamURL, _, err := goanime.NewClient().GetEpisodeStreamURL(anime, episode, &goanime.StreamOptions{
		Quality: quality,
		Mode:    mode,
	})
	if err != nil {
		return "", "", nil, err
	}

	if isAnimeFireVideoAPI(streamURL) {
		resolvedURL, actualQuality, err := resolveAnimeFireVideoAPI(streamURL, quality)
		return resolvedURL, actualQuality, animeFireHeaders(), err
	}

	return streamURL, quality, headersForStream(streamURL), nil
}

func resolveAnimeFireVideoAPI(raw string, quality string) (string, string, error) {
	req, err := http.NewRequest(http.MethodGet, raw, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", userAgent())
	req.Header.Set("Referer", "https://animefire.io/")
	req.Header.Set("Accept", "application/json,text/plain,*/*")

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("AnimeFire video API returned HTTP %d", resp.StatusCode)
	}

	var payload animeFireVideoAPI
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", "", err
	}
	if len(payload.Data) == 0 {
		return "", "", fmt.Errorf("AnimeFire video API returned no streams")
	}

	wanted := strings.ToLower(strings.TrimSpace(quality))
	best := payload.Data[0]
	bestScore := qualityScore(best.Label)
	for _, item := range payload.Data {
		label := strings.ToLower(item.Label)
		if wanted != "" && wanted != "best" && wanted != "worst" && label == wanted {
			return item.Src, item.Label, nil
		}
		score := qualityScore(item.Label)
		if wanted == "worst" {
			if score < bestScore {
				best = item
				bestScore = score
			}
		} else if score > bestScore {
			best = item
			bestScore = score
		}
	}
	return best.Src, best.Label, nil
}

func isAnimeFireVideoAPI(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Host)
	return strings.Contains(host, "animefire") && strings.HasPrefix(parsed.Path, "/video/")
}

func streamType(raw string) string {
	lower := strings.ToLower(raw)
	switch {
	case strings.Contains(lower, ".m3u8"):
		return "hls"
	case strings.Contains(lower, ".mp4"):
		return "mp4"
	default:
		return "unknown"
	}
}

func headersForStream(raw string) map[string]string {
	lower := strings.ToLower(raw)
	if strings.Contains(lower, "animefire") || strings.Contains(lower, "lightspeedst") {
		return animeFireHeaders()
	}
	return nil
}

func isAllowedProxyHost(host string) bool {
	lower := strings.ToLower(host)
	return strings.Contains(lower, "animefire") || strings.Contains(lower, "lightspeedst")
}

func copyHeader(w http.ResponseWriter, source http.Header, key string) {
	value := source.Get(key)
	if value != "" {
		w.Header().Set(key, value)
	}
}

func animeFireHeaders() map[string]string {
	return map[string]string{"Referer": "https://animefire.io/"}
}

func qualityScore(label string) int {
	lower := strings.ToLower(label)
	switch {
	case strings.Contains(lower, "1080"), strings.Contains(lower, "fhd"), strings.Contains(lower, "full hd"), strings.Contains(lower, "fullhd"):
		return 1080
	case strings.Contains(lower, "720"), strings.TrimSpace(lower) == "hd":
		return 720
	case strings.Contains(lower, "480"):
		return 480
	case strings.Contains(lower, "360"), strings.TrimSpace(lower) == "sd":
		return 360
	default:
		return 0
	}
}

func parseSourceName(name string) (types.Source, error) {
	normalized := strings.ToLower(strings.TrimSpace(name))
	switch {
	case strings.Contains(normalized, "animefire"):
		return types.ParseSource("AnimeFire")
	case strings.Contains(normalized, "allanime"):
		return types.ParseSource("AllAnime")
	default:
		return types.ParseSource(name)
	}
}

func canonicalSource(source types.Source) string {
	switch source {
	case types.SourceAnimeFire:
		return "AnimeFire"
	case types.SourceAllAnime:
		return "AllAnime"
	default:
		return source.String()
	}
}

func userAgent() string {
	return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
