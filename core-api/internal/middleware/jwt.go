package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

// In production, this should be imported from a central config
var jwtKey = []byte("my_super_secret_cineflow_key_123!")

type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

type contextKey string
const UserContextKey contextKey = "user"
const ProjectRoleContextKey contextKey = "project_role"

func GetClaims(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(UserContextKey).(*Claims)
	return claims, ok
}

func GetProjectRole(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(ProjectRoleContextKey).(string)
	return role, ok
}

// RequireAuth ensures the request has a valid JWT token
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only check /api/ routes
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		// Bypass authentication for public routes
		if r.URL.Path == "/api/auth/login" || r.URL.Path == "/health" || r.URL.Path == "/api/ws" || r.Method == "OPTIONS" {
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
		claims := &Claims{}

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

// RequireProjectAccess verifies the user is assigned to the project and injects their project-specific role
func RequireProjectAccess(db *database.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract project ID from URL parameters
			// Assuming we use chi Router which injects URLParams into context
			var projectID string
			
			// We need to extract the project ID from the path directly if chi hasn't routed it yet,
			// or we can just rely on chi's context if this middleware is attached to the route.
			// Let's parse it from path manually as a fallback since chi context might not be fully populated in global middleware
			parts := strings.Split(r.URL.Path, "/")
			for i, p := range parts {
				if p == "projects" && i+1 < len(parts) {
					projectID = parts[i+1]
					break
				}
			}

			if projectID == "" {
				// Not a project specific route
				next.ServeHTTP(w, r)
				return
			}

			claims, ok := GetClaims(r.Context())
			if !ok {
				http.Error(w, "Unauthorized context missing", http.StatusUnauthorized)
				return
			}

			var roleName string
			err := db.Pool.QueryRow(context.Background(), `
				SELECT role_name FROM project_users WHERE project_id = $1 AND user_id = $2
			`, projectID, claims.UserID).Scan(&roleName)

			if err != nil {
				http.Error(w, "Forbidden: not assigned to this project", http.StatusForbidden)
				return
			}

			// Inject project role into context
			ctx := context.WithValue(r.Context(), ProjectRoleContextKey, roleName)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole checks if the user's project-specific role matches one of the allowed roles
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			roleName, ok := GetProjectRole(r.Context())
			if !ok {
				http.Error(w, "Forbidden: no project access found", http.StatusForbidden)
				return
			}

			// If no allowedRoles specified, assume any authenticated user is fine
			if len(allowedRoles) == 0 {
				next.ServeHTTP(w, r)
				return
			}

			roleAllowed := false
			for _, role := range allowedRoles {
				if roleName == role {
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

const StudioRoleContextKey contextKey = "studio_role"

func GetStudioRole(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(StudioRoleContextKey).(string)
	return role, ok
}

// RequireStudioAccess verifies the user is assigned to the studio and injects their studio-specific role
func RequireStudioAccess(db *database.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract studio ID from URL parameters
			var studioID string
			parts := strings.Split(r.URL.Path, "/")
			for i, p := range parts {
				if p == "studios" && i+1 < len(parts) {
					studioID = parts[i+1]
					break
				}
			}

			if studioID == "" {
				// Not a studio specific route
				next.ServeHTTP(w, r)
				return
			}

			claims, ok := GetClaims(r.Context())
			if !ok {
				http.Error(w, "Unauthorized context missing", http.StatusUnauthorized)
				return
			}

			var roleName string
			err := db.Pool.QueryRow(context.Background(), `
				SELECT role_name FROM studio_users WHERE studio_id = $1 AND user_id = $2
			`, studioID, claims.UserID).Scan(&roleName)

			if err != nil {
				http.Error(w, "Forbidden: not assigned to this studio", http.StatusForbidden)
				return
			}

			// Inject studio role into context
			ctx := context.WithValue(r.Context(), StudioRoleContextKey, roleName)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
