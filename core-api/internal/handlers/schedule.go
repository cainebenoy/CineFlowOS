package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	"github.com/go-chi/chi/v5"
)

type ScheduleHandler struct {
	DB *database.DB
}

// StripboardScene represents a single draggable strip on the board
type StripboardScene struct {
	ID               string `json:"id"`
	SceneID          string `json:"scene_id"`
	SceneNumber      string `json:"scene_number"`
	Setting          string `json:"setting"`
	TimeOfDay        string `json:"time_of_day"`
	Summary          string `json:"summary"`
	SortOrder        int    `json:"sort_order"`
	EstimatedMinutes int    `json:"estimated_minutes"`
}

// GetProjectSchedule fetches all scenes and their schedule data for a project
func (h *ScheduleHandler) GetProjectSchedule(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	// This query joins the static scene data with the dynamic scheduling data, using COALESCE to handle nullable columns
	query := `
		SELECT 
			COALESCE(ss.id::text, '') as id, 
			s.id as scene_id, 
			s.scene_number, 
			COALESCE(s.setting, '') as setting, 
			COALESCE(s.time_of_day, '') as time_of_day, 
			COALESCE(s.summary, '') as summary, 
			COALESCE(ss.sort_order, 0) as sort_order, 
			COALESCE(ss.estimated_minutes, 0) as estimated_minutes
		FROM scenes s
		LEFT JOIN scheduled_scenes ss ON s.id = ss.scene_id
		WHERE s.project_id = $1
		ORDER BY ss.sort_order ASC NULLS LAST, s.scene_number ASC
	`
	
	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		log.Printf("Error querying project schedule: %v", err)
		http.Error(w, `{"error": "Failed to fetch schedule"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	scenes := make([]StripboardScene, 0)
	for rows.Next() {
		var s StripboardScene
		if err := rows.Scan(&s.ID, &s.SceneID, &s.SceneNumber, &s.Setting, &s.TimeOfDay, &s.Summary, &s.SortOrder, &s.EstimatedMinutes); err != nil {
			log.Printf("Row scan error: %v", err)
			continue
		}
		scenes = append(scenes, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scenes)
}