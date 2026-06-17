package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type DPRHandler struct {
	DB *database.DB
}

func (h *DPRHandler) GetDPR(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	targetDateStr := r.URL.Query().Get("date")

	if targetDateStr == "" {
		// Default to today if no date provided
		targetDateStr = time.Now().Format("2006-01-02")
	}

	targetDate, err := time.Parse("2006-01-02", targetDateStr)
	if err != nil {
		http.Error(w, "Invalid date format, use YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	dpr := map[string]interface{}{
		"date": targetDateStr,
		"project_id": projectID,
	}

	// 1. Fetch Shoot Day Info
	var dayNumber int
	err = h.DB.Pool.QueryRow(context.Background(), `
		SELECT day_number FROM shoot_days 
		WHERE project_id = $1 AND shoot_date = $2 LIMIT 1
	`, projectID, targetDate).Scan(&dayNumber)
	
	if err == nil {
		dpr["day_number"] = dayNumber
	} else {
		dpr["day_number"] = nil // Not explicitly scheduled
	}

	// 2. Fetch Scheduled Scenes
	scheduledScenesRows, _ := h.DB.Pool.Query(context.Background(), `
		SELECT s.scene_number, s.summary, ss.estimated_minutes, s.id
		FROM scheduled_scenes ss
		JOIN scenes s ON ss.scene_id = s.id
		JOIN shoot_days sd ON ss.shoot_day_id = sd.id
		WHERE sd.project_id = $1 AND sd.shoot_date = $2
		ORDER BY ss.sort_order ASC
	`, projectID, targetDate)
	
	scheduled := []map[string]interface{}{}
	scheduledSceneIDs := make(map[string]bool)
	for scheduledScenesRows.Next() {
		var num, summary string
		var est int
		var sceneID string
		scheduledScenesRows.Scan(&num, &summary, &est, &sceneID)
		scheduled = append(scheduled, map[string]interface{}{
			"scene_number": num,
			"summary": summary,
			"estimated_minutes": est,
			"id": sceneID,
		})
		scheduledSceneIDs[sceneID] = true
	}
	scheduledScenesRows.Close()
	dpr["scheduled_scenes"] = scheduled

	// 3. Fetch Completed Scenes (Takes logged today)
	takesRows, _ := h.DB.Pool.Query(context.Background(), `
		SELECT s.scene_number, s.id, COUNT(t.id) as take_count, SUM(t.duration_seconds) as total_duration
		FROM takes t
		JOIN scenes s ON t.scene_id = s.id
		WHERE t.project_id = $1 AND t.created_at::date = $2
		GROUP BY s.scene_number, s.id
	`, projectID, targetDate)

	completed := []map[string]interface{}{}
	for takesRows.Next() {
		var num, sceneID string
		var count int
		var duration int
		takesRows.Scan(&num, &sceneID, &count, &duration)
		completed = append(completed, map[string]interface{}{
			"scene_number": num,
			"scene_id": sceneID,
			"take_count": count,
			"total_duration_seconds": duration,
			"was_scheduled": scheduledSceneIDs[sceneID],
		})
	}
	takesRows.Close()
	dpr["completed_scenes"] = completed

	// 4. Fetch Crew Attendance
	attendanceRows, _ := h.DB.Pool.Query(context.Background(), `
		SELECT c.name, c.role, a.check_in_time
		FROM attendance_logs a
		JOIN crew_members c ON a.crew_id = c.id
		WHERE a.project_id = $1 AND a.check_in_time::date = $2
		ORDER BY a.check_in_time ASC
	`, projectID, targetDate)

	attendance := []map[string]interface{}{}
	for attendanceRows.Next() {
		var name, role string
		var checkIn time.Time
		attendanceRows.Scan(&name, &role, &checkIn)
		attendance = append(attendance, map[string]interface{}{
			"name": name,
			"role": role,
			"check_in_time": checkIn,
		})
	}
	attendanceRows.Close()
	dpr["attendance"] = attendance

	// 5. Fetch Petty Cash Burn
	expenseRows, _ := h.DB.Pool.Query(context.Background(), `
		SELECT vendor_name, category, amount, status
		FROM expenses
		WHERE project_id = $1 AND created_at::date = $2
		ORDER BY created_at DESC
	`, projectID, targetDate)

	expenses := []map[string]interface{}{}
	var totalBurn float64 = 0
	for expenseRows.Next() {
		var vendor, category, status string
		var amount float64
		expenseRows.Scan(&vendor, &category, &amount, &status)
		expenses = append(expenses, map[string]interface{}{
			"vendor_name": vendor,
			"category": category,
			"amount": amount,
			"status": status,
		})
		totalBurn += amount
	}
	expenseRows.Close()
	dpr["expenses"] = expenses
	dpr["total_burn"] = totalBurn

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dpr)
}
