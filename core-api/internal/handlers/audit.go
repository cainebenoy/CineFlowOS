package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"time"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type AuditHandler struct {
	DB *database.DB
}

type AuditLog struct {
	ID        string          `json:"id"`
	TableName string          `json:"table_name"`
	Action    string          `json:"action"`
	OldData   json.RawMessage `json:"old_data"`
	NewData   json.RawMessage `json:"new_data"`
	CreatedAt time.Time       `json:"created_at"`
}

func (h *AuditHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT id, table_name, action, old_data, new_data, created_at 
		FROM system_audit_logs 
		WHERE project_id = $1 
		ORDER BY created_at DESC 
		LIMIT 100
	`
	
	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch audit logs"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if err := rows.Scan(&l.ID, &l.TableName, &l.Action, &l.OldData, &l.NewData, &l.CreatedAt); err == nil {
			logs = append(logs, l)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
