package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/handlers"
)

// In production, this should be imported from a central config
var jwtKey = []byte("my_super_secret_cineflow_key_123!")

type contextKey string
const UserContextKey contextKey = "user"

// RequireAuth ensures the request has a valid JWT token
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only check /api/ routes
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		// Allow public auth routes to pass through
		if r.URL.Path == "/api/auth/login" || r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header missing", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]
		claims := &handlers.Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Inject claims into context
		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole checks if the user's role matches one of the allowed roles
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserContextKey).(*handlers.Claims)
			if !ok {
				http.Error(w, "Unauthorized context missing", http.StatusUnauthorized)
				return
			}

			// If no allowedRoles specified, assume any authenticated user is fine
			if len(allowedRoles) == 0 {
				next.ServeHTTP(w, r)
				return
			}

			roleAllowed := false
			for _, role := range allowedRoles {
				if claims.RoleName == role {
					roleAllowed = true
					break
				}
			}

			if !roleAllowed {
				http.Error(w, "Forbidden: insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
