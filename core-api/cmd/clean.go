package main

import (
	"context"
	"fmt"
	"log"

	"github.com/cainebenoy/CineFlowOS/core-api/internal/database"
)

func main() {
	db, err := database.NewDB("postgres://postgres:postgres@localhost:5432/cineflow?sslmode=disable")
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer db.Close()

	query := `DELETE FROM scheduled_scenes WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = 'd0b7f09b-3f77-4f66-96ec-58da322306f9')`
	tag, err := db.Pool.Exec(context.Background(), query)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	fmt.Printf("Deleted %d rows\n", tag.RowsAffected())
}
