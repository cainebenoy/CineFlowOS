package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
)

// ScriptUploadHandler handles .fountain and .txt file uploads,
// reads the raw text, and proxies it to the Python AI worker.
// The Go gateway is the single ingress point — Next.js never calls Python directly.
type ScriptUploadHandler struct{}

type fountainProxyPayload struct {
	ProjectID  string `json:"project_id"`
	ScriptText string `json:"script_text"`
}

// UploadScript accepts a multipart/form-data file upload (field name: "file"),
// validates the extension (.fountain or .txt), reads the text, and forwards it
// to the Python /api/ai/parse-fountain endpoint.
func (h *ScriptUploadHandler) UploadScript(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	// Parse the multipart form — limit to 10 MB (handles any realistic screenplay)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, `{"error": "File too large or not a valid multipart form"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error": "No file found. Use field name 'file'"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file extension
	name := strings.ToLower(header.Filename)
	if !strings.HasSuffix(name, ".fountain") && !strings.HasSuffix(name, ".txt") {
		http.Error(w, `{"error": "Only .fountain and .txt files are accepted"}`, http.StatusUnsupportedMediaType)
		return
	}

	// Read the raw text bytes
	raw, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, `{"error": "Failed to read uploaded file"}`, http.StatusInternalServerError)
		return
	}

	scriptText := string(raw)
	if strings.TrimSpace(scriptText) == "" {
		http.Error(w, `{"error": "The uploaded file is empty"}`, http.StatusBadRequest)
		return
	}

	// Build the proxy payload to the Python AI worker
	payload := fountainProxyPayload{
		ProjectID:  projectID,
		ScriptText: scriptText,
	}
	payloadBytes, _ := json.Marshal(payload)

	aiWorkerURL := os.Getenv("AI_WORKER_URL")
	if aiWorkerURL == "" {
		aiWorkerURL = "http://localhost:8000"
	}

	// Forward to Python AI worker — this is a long-running call (Gemini per scene)
	resp, err := http.Post(
		aiWorkerURL+"/api/ai/parse-fountain",
		"application/json",
		bytes.NewBuffer(payloadBytes),
	)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "AI worker unavailable: %s"}`, err.Error()), http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	// Stream the AI response (including partial success metadata) back to the client
	body, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
