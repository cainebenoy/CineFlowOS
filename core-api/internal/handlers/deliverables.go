package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	"github.com/go-chi/chi/v5"
)

type DeliverablesHandler struct {
	DB *database.DB
}

// GetDeliverablesDashboard returns summary stats for the dashboard
func (h *DeliverablesHandler) GetDeliverablesDashboard(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	var stats struct {
		TotalScenes   int `json:"total_scenes"`
		TotalTakes    int `json:"total_takes"`
		CircledTakes  int `json:"circled_takes"`
		VFXShots      int `json:"vfx_shots"`
	}

	query := `
		SELECT 
			(SELECT COUNT(*) FROM scenes WHERE project_id = $1) as total_scenes,
			(SELECT COUNT(*) FROM takes WHERE project_id = $1) as total_takes,
			(SELECT COUNT(*) FROM takes WHERE project_id = $1 AND is_circled = TRUE) as circled_takes,
			(SELECT COUNT(DISTINCT s.id) 
			 FROM scenes s 
			 JOIN scene_elements se ON s.id = se.scene_id 
			 JOIN breakdown_elements be ON se.element_id = be.id 
			 WHERE s.project_id = $1 AND be.category ILIKE '%VFX%') as vfx_shots
	`

	err := h.DB.Pool.QueryRow(context.Background(), query, projectID).Scan(
		&stats.TotalScenes, &stats.TotalTakes, &stats.CircledTakes, &stats.VFXShots,
	)

	if err != nil {
		http.Error(w, `{"error": "Failed to fetch dashboard stats"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ExportEditorTurnover generates a structured CSV of all circled takes
func (h *DeliverablesHandler) ExportEditorTurnover(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT 
			s.scene_number, s.setting, s.time_of_day, 
			t.take_number, t.lens, t.duration_seconds, t.supervisor_notes
		FROM takes t
		JOIN scenes s ON t.scene_id = s.id
		WHERE t.project_id = $1 AND t.is_circled = TRUE
		ORDER BY s.scene_number ASC, t.take_number ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch turnover data"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"editor_turnover_%s.csv\"", projectID))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write Header
	writer.Write([]string{"Scene", "Setting", "Time of Day", "Take", "Lens", "Duration (s)", "Notes"})

	for rows.Next() {
		var sceneNum, setting, tod, lens, notes string
		var takeNum, duration int

		// Use pointers for nullable columns like lens, duration_seconds, notes
		var dbLens, dbNotes *string
		var dbDuration *int

		if err := rows.Scan(&sceneNum, &setting, &tod, &takeNum, &dbLens, &dbDuration, &dbNotes); err == nil {
			if dbLens != nil { lens = *dbLens }
			if dbNotes != nil { notes = *dbNotes }
			if dbDuration != nil { duration = *dbDuration }
			
			record := []string{
				sceneNum, setting, tod, strconv.Itoa(takeNum), lens, strconv.Itoa(duration), notes,
			}
			writer.Write(record)
		}
	}
}

type VFXShot struct {
	SceneNumber string `json:"scene_number"`
	Setting     string `json:"setting"`
	TimeOfDay   string `json:"time_of_day"`
	TakeNumber  int    `json:"take_number"`
	Lens        string `json:"lens"`
	VFXElements string `json:"vfx_elements"`
}

// GetVFXPullList returns all circled takes for scenes that have a VFX breakdown element
func (h *DeliverablesHandler) GetVFXPullList(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT 
			s.scene_number, s.setting, s.time_of_day, 
			t.take_number, t.lens,
			string_agg(DISTINCT be.name, ', ') as vfx_elements
		FROM takes t
		JOIN scenes s ON t.scene_id = s.id
		JOIN scene_elements se ON s.id = se.scene_id
		JOIN breakdown_elements be ON se.element_id = be.id
		WHERE t.project_id = $1 
		  AND t.is_circled = TRUE 
		  AND be.category ILIKE '%VFX%'
		GROUP BY s.id, s.scene_number, s.setting, s.time_of_day, t.id, t.take_number, t.lens
		ORDER BY s.scene_number ASC, t.take_number ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch VFX pull list"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var shots []VFXShot
	for rows.Next() {
		var s VFXShot
		var dbLens *string
		if err := rows.Scan(&s.SceneNumber, &s.Setting, &s.TimeOfDay, &s.TakeNumber, &dbLens, &s.VFXElements); err == nil {
			if dbLens != nil { s.Lens = *dbLens }
			shots = append(shots, s)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shots)
}
