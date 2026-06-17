package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

// GetStudioSlate retrieves all projects under a studio and aggregates their financial health
func GetStudioSlate(db *database.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		studioID := chi.URLParam(r, "id")

		// Query to fetch projects along with their total estimated and actual costs
		rows, err := db.Pool.Query(context.Background(), `
			SELECT 
				p.id, 
				p.title, 
				p.project_type, 
				p.status,
				COALESCE(SUM(b.estimated_cost), 0) AS total_estimated,
				(
					SELECT COALESCE(SUM(amount), 0) 
					FROM expenses e 
					WHERE e.project_id = p.id AND e.status = 'Approved'
				) AS total_actual
			FROM projects p
			LEFT JOIN breakdown_elements b ON p.id = b.project_id
			WHERE p.studio_id = $1
			GROUP BY p.id
			ORDER BY p.created_at DESC
		`, studioID)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var slate []map[string]interface{}
		for rows.Next() {
			var id, title, projectType, status string
			var totalEstimated, totalActual float64

			if err := rows.Scan(&id, &title, &projectType, &status, &totalEstimated, &totalActual); err != nil {
				continue
			}

			slate = append(slate, map[string]interface{}{
				"id":              id,
				"title":           title,
				"project_type":    projectType,
				"status":          status,
				"total_estimated": totalEstimated,
				"total_actual":    totalActual,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(slate)
	}
}
