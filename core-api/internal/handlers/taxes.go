package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type TaxesHandler struct {
	DB *database.DB
}

type TaxWithholding struct {
	ID          string    `json:"id"`
	EntityType  string    `json:"entity_type"`
	EntityName  string    `json:"entity_name"`
	PANNumber   string    `json:"pan_number"`
	Section     string    `json:"section"`
	GrossAmount float64   `json:"gross_amount"`
	TDSDeducted float64   `json:"tds_deducted"`
	NetPayable  float64   `json:"net_payable"`
	CreatedAt   time.Time `json:"created_at"`
}

// GetTaxLedger returns all TDS deductions for a project, joining with expenses/crew to get names and PANs
func (h *TaxesHandler) GetTaxLedger(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT 
			t.id, t.entity_type, 
			COALESCE(e.vendor_name, c.name, 'Unknown Entity') as entity_name,
			COALESCE(e.pan_number, c.pan_number, 'UNREGISTERED') as pan_number,
			t.section, t.gross_amount, t.tds_deducted, t.net_payable, t.created_at
		FROM tax_withholdings t
		LEFT JOIN expenses e ON t.entity_type = 'Vendor' AND t.entity_id = e.id
		LEFT JOIN crew_members c ON t.entity_type = 'Crew' AND t.entity_id = c.id
		WHERE t.project_id = $1
		ORDER BY t.created_at DESC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch tax ledger"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var ledger []TaxWithholding
	for rows.Next() {
		var tw TaxWithholding
		if err := rows.Scan(&tw.ID, &tw.EntityType, &tw.EntityName, &tw.PANNumber, &tw.Section, &tw.GrossAmount, &tw.TDSDeducted, &tw.NetPayable, &tw.CreatedAt); err == nil {
			ledger = append(ledger, tw)
		}
	}

	if ledger == nil {
		ledger = []TaxWithholding{} // Return empty array instead of null
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ledger)
}

// ExportTDSReport generates a CSV formatted for standard accounting software
func (h *TaxesHandler) ExportTDSReport(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT 
			t.created_at::DATE,
			COALESCE(e.vendor_name, c.name, 'Unknown Entity') as entity_name,
			t.entity_type,
			COALESCE(e.pan_number, c.pan_number, 'UNREGISTERED') as pan_number,
			t.section, 
			t.gross_amount, 
			t.tds_deducted, 
			t.net_payable
		FROM tax_withholdings t
		LEFT JOIN expenses e ON t.entity_type = 'Vendor' AND t.entity_id = e.id
		LEFT JOIN crew_members c ON t.entity_type = 'Crew' AND t.entity_id = c.id
		WHERE t.project_id = $1
		ORDER BY t.created_at ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate TDS report"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=TDS_Report_%s.csv", time.Now().Format("2006-01-02")))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write CSV Header
	writer.Write([]string{"Date", "Entity Name", "Type", "PAN Number", "TDS Section", "Gross Amount", "TDS Deducted", "Net Payable"})

	for rows.Next() {
		var date time.Time
		var name, eType, pan, section string
		var gross, tds, net float64

		if err := rows.Scan(&date, &name, &eType, &pan, &section, &gross, &tds, &net); err == nil {
			writer.Write([]string{
				date.Format("2006-01-02"),
				name,
				eType,
				pan,
				section,
				fmt.Sprintf("%.2f", gross),
				fmt.Sprintf("%.2f", tds),
				fmt.Sprintf("%.2f", net),
			})
		}
	}
}
