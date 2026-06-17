package handlers

import (
	"context"
	"net/http"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	customMiddleware "github.com/cainebenoy/CineFlowOS/core-api/internal/middleware"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/websocket"
	"github.com/golang-jwt/jwt/v5"
)

type WebSocketHandler struct {
	DB  *database.DB
	Hub *websocket.Hub
}

func (h *WebSocketHandler) HandleConnections(w http.ResponseWriter, r *http.Request) {
	// Parse URL queries
	tokenString := r.URL.Query().Get("token")
	projectID := r.URL.Query().Get("projectId")

	if tokenString == "" || projectID == "" {
		http.Error(w, "Missing token or projectId", http.StatusBadRequest)
		return
	}

	// Manual JWT Decoding (since we can't rely on the global Bearer token middleware here)
	claims := &customMiddleware.Claims{}
	// NOTE: We're temporarily hardcoding the same JWT key string used in auth.go
	// In production this must be loaded from an env var dynamically across the app.
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte("my_super_secret_cineflow_key_123!"), nil
	})

	if err != nil || !token.Valid {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// Verify the user has access to this specific project
	var roleName string
	err = h.DB.Pool.QueryRow(context.Background(), `
		SELECT role_name FROM project_users WHERE project_id = $1 AND user_id = $2
	`, projectID, claims.UserID).Scan(&roleName)

	if err != nil {
		http.Error(w, "Forbidden: no access to project", http.StatusForbidden)
		return
	}

	// Handshake successful, upgrade the connection
	websocket.ServeWs(h.Hub, projectID, claims.UserID, w, r)
}
