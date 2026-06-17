package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	"github.com/go-chi/chi/v5"
)

type WhatsAppHandler struct {
	DB *database.DB
}

type CrewMember struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	PhoneNumber string `json:"phone_number"`
}

// DistributeCallSheet sends the call sheet to all active crew members concurrently
func (h *WhatsAppHandler) DistributeCallSheet(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	// 1. Fetch the crew list
	query := `SELECT name, role, phone_number FROM crew_members WHERE project_id = $1 AND is_active = TRUE`
	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch crew"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var crew []CrewMember
	for rows.Next() {
		var c CrewMember
		if err := rows.Scan(&c.Name, &c.Role, &c.PhoneNumber); err == nil {
			crew = append(crew, c)
		}
	}

	// 2. Setup concurrency channels and WaitGroup
	var wg sync.WaitGroup
	results := make(chan string, len(crew))

	// 3. Fire off the requests concurrently
	for _, member := range crew {
		wg.Add(1)
		go func(c CrewMember) {
			defer wg.Done()
			
			// Simulate the Meta API call (Replace with actual Meta Graph API request later)
			success := mockWhatsAppSend(c.PhoneNumber, c.Name, "06:00 AM", "http://localhost:3000/projects/"+projectID+"/callsheet")
			
			if success {
				results <- fmt.Sprintf("Sent to %s (%s)", c.Name, c.Role)
			} else {
				results <- fmt.Sprintf("Failed for %s", c.Name)
			}
		}(member)
	}

	// 4. Wait for all goroutines to finish and close the channel
	wg.Wait()
	close(results)

	// 5. Collect logs
	var distributionLogs []string
	for res := range results {
		distributionLogs = append(distributionLogs, res)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"logs":   distributionLogs,
	})
}

// mockWhatsAppSend simulates hitting the Meta WhatsApp API
func mockWhatsAppSend(phone, name, callTime, link string) bool {
	// In production: construct JSON payload and POST to https://graph.facebook.com/v19.0/.../messages
	fmt.Printf("[WHATSAPP MOCK] Message sent to %s (%s): Your call time is %s. View sheet: %s\n", name, phone, callTime, link)
	return true
}
