package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/middleware"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// In production, this should be imported from a central config
var jwtKey = []byte("my_super_secret_cineflow_key_123!")

type AuthHandler struct {
	DB *database.DB
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var userID, passwordHash string

	// Fetch user from DB
	err := h.DB.Pool.QueryRow(context.Background(), `
		SELECT id, password_hash FROM users WHERE email = $1
	`, req.Email).Scan(&userID, &passwordHash)

	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Verify Password
	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Declare the expiration time of the token
	expirationTime := time.Now().Add(24 * time.Hour)

	// Create the JWT claims
	claims := &middleware.Claims{
		UserID:   userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user": map[string]string{
			"id":    userID,
			"email": req.Email,
		},
	})
}
