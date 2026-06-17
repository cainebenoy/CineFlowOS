package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type BudgetHandler struct {
	DB *database.DB
}

type BudgetItem struct {
	ID            string  `json:"id"`
	Category      string  `json:"category"`
	Name          string  `json:"name"`
	EstimatedCost float64 `json:"estimated_cost"`
	ActualCost    float64 `json:"actual_cost"`
}

// GetBudget fetches all breakdown elements with their financial data
func (h *BudgetHandler) GetBudget(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT id, category, name, estimated_cost, actual_cost 
		FROM breakdown_elements 
		WHERE project_id = $1 
		ORDER BY category ASC, name ASC
	`
	
	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch budget"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []BudgetItem
	for rows.Next() {
		var i BudgetItem
		if err := rows.Scan(&i.ID, &i.Category, &i.Name, &i.EstimatedCost, &i.ActualCost); err == nil {
			items = append(items, i)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// UpdateBudgetItem updates the financial numbers for a specific element
func (h *BudgetHandler) UpdateBudgetItem(w http.ResponseWriter, r *http.Request) {
	elementID := chi.URLParam(r, "elementId")

	var payload struct {
		EstimatedCost float64 `json:"estimated_cost"`
		ActualCost    float64 `json:"actual_cost"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid payload"}`, http.StatusBadRequest)
		return
	}

	query := `UPDATE breakdown_elements SET estimated_cost = $1, actual_cost = $2 WHERE id = $3`
	_, err := h.DB.Pool.Exec(context.Background(), query, payload.EstimatedCost, payload.ActualCost, elementID)

	if err != nil {
		http.Error(w, `{"error": "Failed to update budget"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "success"}`))
}
