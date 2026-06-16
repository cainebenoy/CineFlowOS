package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	
	// REMEMBER: Update this to match your actual go.mod path!
	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
	"github.com/cainebenoy/CineFlowOS/core-api/internal/handlers"
)

func main() {
	// Load the .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found, relying on system environment variables")
	}

	// Initialize Database Connection
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("Fatal error connecting to database: %v", err)
	}
	defer db.Pool.Close()

	// Initialize Schema
	if err := db.InitSchema(); err != nil {
		log.Fatalf("Fatal error initializing schema: %v", err)
	}

	// Initialize Handlers
	projectHandler := &handlers.ProjectHandler{DB: db}
	scheduleHandler := &handlers.ScheduleHandler{DB: db}

	// Set up the HTTP Router
	r := chi.NewRouter()

	// Middleware (logs requests and prevents crashes)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS setup (Crucial for Next.js communication)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"}, // Next.js default port
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
	}))

	// Define our first route!
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("CineFlow Core API is live and healthy!"))
	})

	// Define explicit routes (handles the missing trailing slash natively)
	r.Get("/api/projects", projectHandler.ListProjects)
	r.Post("/api/projects", projectHandler.CreateProject)
	r.Get("/api/projects/{id}/schedule", scheduleHandler.GetProjectSchedule)
	r.Put("/api/projects/{id}/schedule/order", scheduleHandler.UpdateScheduleOrder)

	// Initialize the handler
	callSheetHandler := &handlers.CallSheetHandler{DB: db}

	// Add the route right under your schedule endpoints
	r.Get("/api/projects/{id}/callsheet", callSheetHandler.GenerateCallSheet)

	// Get port from env or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server... Listening on http://localhost:%s\n", port)

	// Start the server (This blocks the program from exiting)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}