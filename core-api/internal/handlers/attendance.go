package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

type AttendanceHandler struct {
	DB *database.DB
}

// CheckInPayload is the request body for a crew member check-in
type CheckInPayload struct {
	CrewID    string  `json:"crew_id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// AttendanceRecord represents a single row returned by the Line Producer dashboard
type AttendanceRecord struct {
	ID           string    `json:"id"`
	CrewName     string    `json:"crew_name"`
	Role         string    `json:"role"`
	Phone        string    `json:"phone"`
	DailyRate    float64   `json:"daily_rate"`
	CheckInTime  time.Time `json:"check_in_time"`
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	Status       string    `json:"status"`
}

// CrewMember is used for the crew roster
type CrewMember struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Role      string  `json:"role"`
	Phone     string  `json:"phone"`
	DailyRate float64 `json:"daily_rate"`
	UPIID     string  `json:"upi_id"`
	IsActive  bool    `json:"is_active"`
}

// LogCheckIn records a crew member's daily attendance with GPS coordinates.
// Returns 409 Conflict if the crew member has already checked in today.
func (h *AttendanceHandler) LogCheckIn(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	var payload CheckInPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if payload.CrewID == "" {
		http.Error(w, `{"error": "crew_id is required"}`, http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO attendance_logs (project_id, crew_id, latitude, longitude)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`

	var logID string
	err := h.DB.Pool.QueryRow(
		context.Background(),
		query,
		projectID, payload.CrewID, payload.Latitude, payload.Longitude,
	).Scan(&logID)

	if err != nil {
		// The unique index fires when the same crew_id checks in twice in one day
		http.Error(w, `{"error": "Already checked in today"}`, http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Check-in logged successfully.",
		"id":      logID,
	})
}

// GetTodaysAttendance returns all check-ins for today for the Line Producer dashboard
func (h *AttendanceHandler) GetTodaysAttendance(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT 
			al.id,
			cm.name,
			cm.role,
			cm.phone_number,
			cm.daily_rate,
			al.check_in_time,
			COALESCE(al.latitude, 0),
			COALESCE(al.longitude, 0),
			al.status
		FROM attendance_logs al
		JOIN crew_members cm ON al.crew_id = cm.id
		WHERE al.project_id = $1
		  AND al.check_in_time::DATE = CURRENT_DATE
		ORDER BY al.check_in_time ASC
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch attendance"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var records []AttendanceRecord
	for rows.Next() {
		var rec AttendanceRecord
		if err := rows.Scan(
			&rec.ID, &rec.CrewName, &rec.Role, &rec.Phone, &rec.DailyRate,
			&rec.CheckInTime, &rec.Latitude, &rec.Longitude, &rec.Status,
		); err == nil {
			records = append(records, rec)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(records)
}

// GetCrewRoster returns all crew members for a project
func (h *AttendanceHandler) GetCrewRoster(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	query := `
		SELECT id, name, role, phone_number,
		       COALESCE(daily_rate, 0),
		       COALESCE(upi_id, ''),
		       is_active
		FROM crew_members
		WHERE project_id = $1
		ORDER BY role, name
	`

	rows, err := h.DB.Pool.Query(context.Background(), query, projectID)
	if err != nil {
		http.Error(w, `{"error": "Failed to fetch crew roster"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var crew []CrewMember
	for rows.Next() {
		var c CrewMember
		if err := rows.Scan(&c.ID, &c.Name, &c.Role, &c.Phone, &c.DailyRate, &c.UPIID, &c.IsActive); err == nil {
			crew = append(crew, c)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(crew)
}
