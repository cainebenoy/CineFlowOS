package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TakeHandler struct {
	DB *pgxpool.Pool
}

type TakePayload struct {
	SceneID         string `json:"scene_id"`
	TakeNumber      int    `json:"take_number"`
	Lens            string `json:"lens"`
	DurationSeconds int    `json:"duration_seconds"`
	IsCircled       bool   `json:"is_circled"`
	SupervisorNotes string `json:"supervisor_notes"`
}

func (h *TakeHandler) LogTake(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	var payload TakePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO takes (project_id, scene_id, take_number, lens, duration_seconds, is_circled, supervisor_notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (scene_id, take_number) 
		DO UPDATE SET 
			lens = EXCLUDED.lens,
			duration_seconds = EXCLUDED.duration_seconds,
			is_circled = EXCLUDED.is_circled,
			supervisor_notes = EXCLUDED.supervisor_notes
		RETURNING id;
	`
	var takeID string
	err := h.DB.QueryRow(
		context.Background(),
		query,
		projectID,
		payload.SceneID,
		payload.TakeNumber,
		payload.Lens,
		payload.DurationSeconds,
		payload.IsCircled,
		payload.SupervisorNotes,
	).Scan(&takeID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"take_id": takeID})
}

// Fetch all takes for a project to populate the timeline UI
func (h *TakeHandler) GetProjectTakes(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	
	query := `
		SELECT t.id, t.scene_id, s.scene_number, t.take_number, t.lens, t.duration_seconds, t.is_circled, t.supervisor_notes, t.created_at
		FROM takes t
		JOIN scenes s ON t.scene_id = s.id
		WHERE t.project_id = $1
		ORDER BY t.created_at DESC
	`
	
	rows, err := h.DB.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type TakeResponse struct {
		ID              string `json:"id"`
		SceneID         string `json:"scene_id"`
		SceneNumber     string `json:"scene_number"`
		TakeNumber      int    `json:"take_number"`
		Lens            string `json:"lens"`
		DurationSeconds int    `json:"duration_seconds"`
		IsCircled       bool   `json:"is_circled"`
		SupervisorNotes string `json:"supervisor_notes"`
		CreatedAt       string `json:"created_at"`
	}

	var takes []TakeResponse
	for rows.Next() {
		var t TakeResponse
		var lens, notes *string
		var dur *int
		err := rows.Scan(&t.ID, &t.SceneID, &t.SceneNumber, &t.TakeNumber, &lens, &dur, &t.IsCircled, &notes, &t.CreatedAt)
		if err != nil {
			continue
		}
		if lens != nil { t.Lens = *lens }
		if notes != nil { t.SupervisorNotes = *notes }
		if dur != nil { t.DurationSeconds = *dur }
		takes = append(takes, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(takes)
}
