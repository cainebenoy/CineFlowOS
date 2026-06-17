package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type ExpenseHandler struct {
	DB *database.DB
}

// ScanReceiptRequest is the payload from the Next.js client
type ScanReceiptRequest struct {
	ImageBase64 string `json:"image_base64"`
	MimeType    string `json:"mime_type"`
}

// ScanReceiptProxyPayload is what we forward to the Python AI worker
type ScanReceiptProxyPayload struct {
	ProjectID   string `json:"project_id"`
	ImageBase64 string `json:"image_base64"`
	MimeType    string `json:"mime_type"`
}

// ExpensePayload is the request body for saving a confirmed expense
type ExpensePayload struct {
	VendorName string  `json:"vendor_name"`
	GSTIN      string  `json:"gstin"`
	Amount     float64 `json:"amount"`
	Category   string  `json:"category"`
	Notes      string  `json:"notes"`
}

// Expense is the response shape for the ledger
type Expense struct {
	ID         string    `json:"id"`
	VendorName string    `json:"vendor_name"`
	GSTIN      string    `json:"gstin"`
	Amount     float64   `json:"amount"`
	Category   string    `json:"category"`
	Status     string    `json:"status"`
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
}

// ScanReceipt proxies the base64 image to the Python AI worker and returns the extraction.
// The Next.js client NEVER talks to Python directly — Go is the single ingress point.
func (h *ExpenseHandler) ScanReceipt(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	var req ScanReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.MimeType == "" {
		req.MimeType = "image/jpeg"
	}

	// Build the proxy payload to the Python AI worker
	proxyPayload := ScanReceiptProxyPayload{
		ProjectID:   projectID,
		ImageBase64: req.ImageBase64,
		MimeType:    req.MimeType,
	}

	payloadBytes, _ := json.Marshal(proxyPayload)

	aiWorkerURL := os.Getenv("AI_WORKER_URL")
	if aiWorkerURL == "" {
		aiWorkerURL = "http://localhost:8000"
	}

	// Forward to Python AI worker
	resp, err := http.Post(
		aiWorkerURL+"/api/ai/scan-receipt",
		"application/json",
		bytes.NewBuffer(payloadBytes),
	)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "AI worker unavailable: %s"}`, err.Error()), http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	// Stream the AI response directly back to the client
	body, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

// LogExpense saves a user-confirmed AI extraction to the expenses table
func (h *ExpenseHandler) LogExpense(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	var payload ExpensePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid payload"}`, http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO expenses (project_id, vendor_name, gstin, amount, category, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	var expenseID string
	err := h.DB.Pool.QueryRow(
		context.Background(),
		query,
		projectID, payload.VendorName, payload.GSTIN, payload.Amount, payload.Category, payload.Notes,
	).Scan(&expenseID)

	if err != nil {
		http.Error(w, `{"error": "Failed to log expense"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":     "success",
		"expense_id": expenseID,
	})
}

// GetExpenses returns the full petty cash ledger for a project
func (h *ExpenseHandler) GetExpenses(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT id, vendor_name, COALESCE(gstin, ''), amount, 
		       COALESCE(category, ''), status, COALESCE(notes, ''), created_at
		FROM expenses
		WHERE project_id = $1
		ORDER BY created_at DESC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch expenses"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var expenses []Expense
	for rows.Next() {
		var e Expense
		if err := rows.Scan(&e.ID, &e.VendorName, &e.GSTIN, &e.Amount, &e.Category, &e.Status, &e.Notes, &e.CreatedAt); err == nil {
			expenses = append(expenses, e)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(expenses)
}

// UpdateExpenseStatus allows the Line Producer to Approve or Reject an expense
func (h *ExpenseHandler) UpdateExpenseStatus(w http.ResponseWriter, r *http.Request) {
	expenseID := chi.URLParam(r, "expenseId")

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || (body.Status != "Approved" && body.Status != "Rejected") {
		http.Error(w, `{"error": "status must be 'Approved' or 'Rejected'"}`, http.StatusBadRequest)
		return
	}

	_, err := h.DB.Pool.Exec(
		context.Background(),
		`UPDATE expenses SET status = $1 WHERE id = $2`,
		body.Status, expenseID,
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to update status"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}
