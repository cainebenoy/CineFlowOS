package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type CallSheetHandler struct {
	DB *database.DB
}

type CallSheetElement struct {
	Category string `json:"category"`
	Name     string `json:"name"`
}

type CallSheetScene struct {
	SceneNumber string             `json:"scene_number"`
	Setting     string             `json:"setting"`
	TimeOfDay   string             `json:"time_of_day"`
	Summary     string             `json:"summary"`
	Elements    []CallSheetElement `json:"elements"`
}

// GenerateCallSheet fetches the ordered schedule and all associated breakdown elements
func (h *CallSheetHandler) GenerateCallSheet(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT 
			s.scene_number, s.setting, s.time_of_day, s.summary,
			COALESCE(
				json_agg(json_build_object('category', be.category, 'name', be.name)) 
				FILTER (WHERE be.id IS NOT NULL), '[]'
			) as elements
		FROM scenes s
		LEFT JOIN scheduled_scenes ss ON s.id = ss.scene_id
		LEFT JOIN scene_elements se ON s.id = se.scene_id
		LEFT JOIN breakdown_elements be ON se.element_id = be.id
		WHERE s.project_id = $1
		GROUP BY s.id, s.scene_number, s.setting, s.time_of_day, s.summary, ss.sort_order
		ORDER BY 
			ss.sort_order ASC NULLS LAST, 
			CAST(NULLIF(regexp_replace(s.scene_number, '[^0-9]', '', 'g'), '') AS INTEGER) ASC NULLS LAST,
			s.scene_number ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate call sheet"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var scenes []CallSheetScene
	for rows.Next() {
		var s CallSheetScene
		var elementsJSON []byte

		if err := rows.Scan(&s.SceneNumber, &s.Setting, &s.TimeOfDay, &s.Summary, &elementsJSON); err != nil {
			continue
		}

		json.Unmarshal(elementsJSON, &s.Elements)
		scenes = append(scenes, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scenes)
}
