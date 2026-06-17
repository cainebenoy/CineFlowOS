package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/middleware"
)

type ProjectHandler struct {
	DB *database.DB
}

type CreateProjectRequest struct {
	Title       string `json:"title"`
	ProjectType string `json:"project_type"`
}

func (h *ProjectHandler) GetProjects(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetClaims(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Pool.Query(context.Background(), `
		SELECT p.id, p.title, p.project_type, p.status, pu.role_name
		FROM projects p
		JOIN project_users pu ON p.id = pu.project_id
		WHERE pu.user_id = $1
		ORDER BY p.created_at DESC
	`, claims.UserID)

	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var projects []map[string]interface{}
	for rows.Next() {
		var id, title, projectType, status, roleName string
		if err := rows.Scan(&id, &title, &projectType, &status, &roleName); err != nil {
			continue
		}
		projects = append(projects, map[string]interface{}{
			"id":           id,
			"title":        title,
			"project_type": projectType,
			"status":       status,
			"role":         roleName,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetClaims(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var projectID string
	err = tx.QueryRow(ctx, `
		INSERT INTO projects (title, project_type, status)
		VALUES ($1, $2, 'active')
		RETURNING id
	`, req.Title, req.ProjectType).Scan(&projectID)

	if err != nil {
		http.Error(w, "Failed to create project", http.StatusInternalServerError)
		return
	}

	// Immediately grant Admin/Line Producer access to the creator
	_, err = tx.Exec(ctx, `
		INSERT INTO project_users (project_id, user_id, role_name)
		VALUES ($1, $2, 'Line Producer')
	`, projectID, claims.UserID)

	if err != nil {
		http.Error(w, "Failed to assign project permissions", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":           projectID,
		"title":        req.Title,
		"project_type": req.ProjectType,
		"role":         "Line Producer",
	})
}