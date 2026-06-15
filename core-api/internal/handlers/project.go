package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

// Project represents the data structure of a film/video production.
type Project struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	ProjectType string    `json:"project_type"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// ProjectHandler holds the database connection pool
type ProjectHandler struct {
	DB *database.DB
}

// CreateProject handles POST requests to create a new production
func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	// Parse the incoming JSON payload
	var p struct {
		Title       string `json:"title"`
		ProjectType string `json:"project_type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, `{"error": "Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	var id string
	var createdAt time.Time
	
	// Execute the insertion and instantly return the generated UUID and timestamp
	query := `INSERT INTO projects (title, project_type) VALUES ($1, $2) RETURNING id, created_at`
	err := h.DB.Pool.QueryRow(context.Background(), query, p.Title, p.ProjectType).Scan(&id, &createdAt)
	
	if err != nil {
		http.Error(w, `{"error": "Failed to create project"}`, http.StatusInternalServerError)
		return
	}

	// Respond with the newly created object
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(Project{
		ID:          id,
		Title:       p.Title,
		ProjectType: p.ProjectType,
		Status:      "active",
		CreatedAt:   createdAt,
	})
}

// ListProjects handles GET requests to fetch all productions
func (h *ProjectHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, title, project_type, status, created_at FROM projects ORDER BY created_at DESC`
	rows, err := h.DB.Pool.Query(context.Background(), query)
	
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch projects"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Initialize as an empty slice so it returns [] instead of null if the DB is empty
	projects := make([]Project, 0)
	
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Title, &p.ProjectType, &p.Status, &p.CreatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}