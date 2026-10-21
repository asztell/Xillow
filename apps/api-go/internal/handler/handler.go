package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi"
	"github.com/xillow/api-go/internal/service"
	"github.com/xillow/api-go/internal/validation"
)

type apiError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Field   string `json:"field,omitempty"`
	} `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message, field string) {
	var e apiError
	e.Error.Code = code
	e.Error.Message = message
	e.Error.Field = field
	writeJSON(w, status, e)
}

type Handler struct {
	Service *service.Service
	Logger  *slog.Logger
}

func New(svc *service.Service, logger *slog.Logger) *Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{Service: svc, Logger: logger}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	res := validation.ParseSearchParams(r.URL.Query())
	if res.Err != nil {
		writeError(w, http.StatusBadRequest, res.Err.Code, res.Err.Message, res.Err.Field)
		return
	}
	result, err := h.Service.Search(r.Context(), res.Params)
	if err != nil {
		h.Logger.Error("GET /listings failed", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Unable to search listings right now.", "")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	source := chi.URLParam(r, "source")
	id := chi.URLParam(r, "id")

	detail, err := h.Service.Detail(r.Context(), id, source)
	if err != nil {
		h.Logger.Error("GET /listings/:source/:id failed", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Unable to load the listing right now.", "")
		return
	}
	if detail == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Listing not found.", "")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

// CORSMiddleware adds permissive CORS headers so the browser UI can call this
// API directly (e.g. the Go backend on its own port) instead of only through
// the Vite dev proxy. Preflight (OPTIONS) requests are answered here.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Use(CORSMiddleware)
	r.Get("/api/health", h.Health)
	r.Route("/api/listings", func(r chi.Router) {
		r.Get("/", h.List)
		r.Get("/{source}/{id}", h.Detail)
	})
}
